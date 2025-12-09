/**
 * @module @skillancer/service-client/saga
 * Create Contract Saga - Example implementation
 *
 * This saga orchestrates the contract creation flow:
 * 1. Validate the bid and job
 * 2. Create the contract
 * 3. Create escrow for initial milestone
 * 4. Notify both parties
 * 5. Update job status
 */

import { billingClient } from '../clients/billing-client.js';
import { marketClient } from '../clients/market-client.js';
import { notificationClient } from '../clients/notification-client.js';
import { EventChannels, EventTypes } from '../events/types.js';
import { logger } from '../logger.js';

import type { SagaDefinition, SagaStep, SagaContext } from './types.js';

/**
 * Input for create contract saga
 */
export interface CreateContractSagaInput {
  bidId: string;
  jobId: string;
  clientId: string;
  freelancerId: string;
  startDate?: string;
  milestones?: Array<{
    title: string;
    description?: string;
    amount: number;
    dueDate?: string;
  }>;
  budget: number;
  currency: string;
}

/**
 * Output from create contract saga
 */
export interface CreateContractSagaOutput {
  contractId: string;
  escrowId?: string;
  jobUpdated: boolean;
  notificationsSent: boolean;
}

// Step 1: Validate bid and job
const validateBidAndJobStep: SagaStep<CreateContractSagaInput, { bid: unknown; job: unknown }> = {
  name: 'validate-bid-and-job',
  description: 'Validate that the bid and job exist and are in correct state',

  async execute(context: SagaContext<CreateContractSagaInput>) {
    const { jobId, bidId } = context.input;

    logger.debug({ sagaId: context.sagaId, jobId, bidId }, 'Validating bid and job');

    // Fetch job and bid in parallel
    const [job, bid] = await Promise.all([marketClient.getJob(jobId), marketClient.getBid(bidId)]);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!bid) {
      throw new Error(`Bid not found: ${bidId}`);
    }

    // Validate states
    if (job.status !== 'open') {
      throw new Error(`Job is not open for contracts: ${job.status}`);
    }

    return { bid, job };
  },

  // No compensation needed - this is a read-only step
};

// Step 2: Create the contract
const createContractStep: SagaStep<CreateContractSagaInput, { contractId: string }> = {
  name: 'create-contract',
  description: 'Create the contract record',

  async execute(context: SagaContext<CreateContractSagaInput>) {
    const { bidId, startDate, milestones } = context.input;

    logger.debug({ sagaId: context.sagaId, bidId }, 'Creating contract');

    const contract = await marketClient.createContract({
      bidId,
      startDate,
      milestones: milestones?.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
      })),
    });

    return { contractId: contract.id };
  },

  async compensate(context: SagaContext<CreateContractSagaInput>, result) {
    const { contractId } = result;

    logger.debug({ sagaId: context.sagaId, contractId }, 'Cancelling contract');

    // Cancel the contract by pausing it
    await marketClient.pauseContract(contractId, 'Saga compensation - rolling back');
  },

  retry: {
    maxAttempts: 3,
    delay: 1000,
  },
};

// Step 3: Create escrow for first milestone
const createEscrowStep: SagaStep<CreateContractSagaInput, { escrowId: string } | null> = {
  name: 'create-escrow',
  description: 'Create escrow for the initial milestone payment',

  async execute(context: SagaContext<CreateContractSagaInput>) {
    const { milestones, currency } = context.input;
    const contractResult = context.state['create-contract'] as { contractId: string } | undefined;

    if (!contractResult) {
      throw new Error('Contract not created - missing from context state');
    }

    // Only create escrow if there are milestones
    if (!milestones?.length) {
      logger.debug({ sagaId: context.sagaId }, 'No milestones, skipping escrow creation');
      return null;
    }

    const firstMilestone = milestones[0];
    if (!firstMilestone) {
      return null;
    }

    logger.debug(
      {
        sagaId: context.sagaId,
        contractId: contractResult.contractId,
        amount: firstMilestone.amount,
      },
      'Creating escrow for first milestone'
    );

    const escrow = await billingClient.createEscrow({
      contractId: contractResult.contractId,
      amount: {
        amount: firstMilestone.amount,
        currency,
      },
    });

    return { escrowId: escrow.id };
  },

  async compensate(context: SagaContext<CreateContractSagaInput>, result) {
    if (!result) return;

    const { escrowId } = result;

    logger.debug({ sagaId: context.sagaId, escrowId }, 'Cancelling escrow');

    // Refund and cancel escrow
    await billingClient.refundEscrow(escrowId);
  },

  retry: {
    maxAttempts: 3,
    delay: 2000,
  },

  // Escrow is optional - contract can exist without immediate escrow
  optional: true,
};

// Step 4: Update job status
const updateJobStatusStep: SagaStep<CreateContractSagaInput, { previousStatus: string }> = {
  name: 'update-job-status',
  description: 'Update job status to in_progress',

  async execute(context: SagaContext<CreateContractSagaInput>) {
    const { jobId } = context.input;
    const validateResult = context.state['validate-bid-and-job'] as
      | { job: { status: string } }
      | undefined;
    const previousStatus = validateResult?.job?.status ?? 'open';

    logger.debug({ sagaId: context.sagaId, jobId }, 'Updating job status');

    await marketClient.updateJob(jobId, { status: 'in_progress' });

    return { previousStatus };
  },

  async compensate(context: SagaContext<CreateContractSagaInput>, result) {
    const { jobId } = context.input;
    const { previousStatus } = result;

    logger.debug({ sagaId: context.sagaId, jobId, previousStatus }, 'Reverting job status');

    // Revert to previous status (cast to valid status)
    const validStatus = previousStatus as
      | 'draft'
      | 'open'
      | 'in_progress'
      | 'completed'
      | 'cancelled'
      | 'closed';
    await marketClient.updateJob(jobId, { status: validStatus });
  },
};

// Step 5: Send notifications
const sendNotificationsStep: SagaStep<CreateContractSagaInput, { sent: boolean }> = {
  name: 'send-notifications',
  description: 'Notify client and freelancer about the contract',

  async execute(context: SagaContext<CreateContractSagaInput>) {
    const { clientId, freelancerId, budget, currency } = context.input;
    const contractResult = context.state['create-contract'] as { contractId: string } | undefined;

    if (!contractResult) {
      logger.warn({ sagaId: context.sagaId }, 'No contract ID available for notifications');
      return { sent: false };
    }

    logger.debug(
      { sagaId: context.sagaId, clientId, freelancerId },
      'Sending contract notifications'
    );

    // Send emails to both parties
    await Promise.all([
      // Notify freelancer via email
      notificationClient.sendEmail({
        to: freelancerId, // Would typically look up email
        templateId: 'contract-awarded',
        subject: 'Contract Awarded',
        data: {
          contractId: contractResult.contractId,
          budget,
          currency,
        },
      }),

      // Notify client via email
      notificationClient.sendEmail({
        to: clientId, // Would typically look up email
        templateId: 'contract-created',
        subject: 'Contract Created',
        data: {
          contractId: contractResult.contractId,
          budget,
          currency,
        },
      }),
    ]);

    return { sent: true };
  },

  // Notifications are optional - contract creation shouldn't fail if notifications fail
  optional: true,

  retry: {
    maxAttempts: 2,
    delay: 500,
  },
};

/**
 * Create Contract Saga Definition
 */
export const createContractSaga: SagaDefinition<CreateContractSagaInput, CreateContractSagaOutput> =
  {
    name: 'create-contract',
    description: 'Orchestrates the complete contract creation flow',
    version: 1,

    steps: [
      validateBidAndJobStep,
      createContractStep,
      createEscrowStep,
      updateJobStatusStep,
      sendNotificationsStep,
    ],

    successEvent: {
      type: EventTypes.Contract.CREATED,
      channel: EventChannels.CONTRACTS,
    },

    failureEvent: {
      type: 'contract.creation_failed',
      channel: EventChannels.CONTRACTS,
    },

    transformOutput(context, stepResults) {
      const contractResult = stepResults.find((r) => r.stepName === 'create-contract');
      const escrowResult = stepResults.find((r) => r.stepName === 'create-escrow');
      const notifyResult = stepResults.find((r) => r.stepName === 'send-notifications');

      const output: CreateContractSagaOutput = {
        contractId:
          (contractResult?.output as { contractId: string } | undefined)?.contractId ?? '',
        jobUpdated:
          stepResults.find((r) => r.stepName === 'update-job-status')?.status === 'completed',
        notificationsSent: notifyResult?.status === 'completed',
      };

      const escrowId = (escrowResult?.output as { escrowId: string } | null | undefined)?.escrowId;
      if (escrowId !== undefined) {
        output.escrowId = escrowId;
      }

      return output;
    },

    timeout: 30000, // 30 seconds
    persist: true,
  };
