/**
 * @module @skillancer/market-svc/repositories/contract-signature
 * Contract Signature data access layer
 */

import crypto from 'node:crypto';

import type { CreateSignatureInput, SignatureWithDetails } from '../types/contract.types.js';
import type { PrismaClient } from '@skillancer/database';

/**
 * Contract Signature Repository
 *
 * Handles database operations for contract signatures.
 */
export class ContractSignatureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    user: {
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    },
  };

  /**
   * Create a signature
   */
  async create(data: CreateSignatureInput) {
    // Generate a unique signature hash
    const signatureHash = this.generateSignatureHash(data);

    return this.prisma.contractSignature.create({
      data: {
        contractId: data.contractId,
        userId: data.userId,
        signerRole: data.signerRole,
        signatureType: data.signatureType,
        signatureImage: data.signatureImage ?? null,
        signatureText: data.signatureText ?? null,
        signatureHash,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        documentHash: data.documentHash,
        documentVersion: data.documentVersion,
        agreedToTerms: true,
        termsVersion: data.termsVersion,
        acknowledgmentAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Find signature by ID
   */
  async findById(id: string): Promise<SignatureWithDetails | null> {
    return this.prisma.contractSignature.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<SignatureWithDetails | null>;
  }

  /**
   * Find signatures for a contract
   */
  async findByContract(contractId: string): Promise<SignatureWithDetails[]> {
    return this.prisma.contractSignature.findMany({
      where: { contractId },
      include: this.defaultInclude,
      orderBy: { createdAt: 'asc' },
    }) as Promise<SignatureWithDetails[]>;
  }

  /**
   * Find signature by contract and user
   */
  async findByContractAndUser(
    contractId: string,
    userId: string
  ): Promise<SignatureWithDetails | null> {
    return this.prisma.contractSignature.findFirst({
      where: { contractId, userId },
      include: this.defaultInclude,
    }) as Promise<SignatureWithDetails | null>;
  }

  /**
   * Check if user has signed
   */
  async hasSigned(contractId: string, userId: string): Promise<boolean> {
    const signature = await this.prisma.contractSignature.findFirst({
      where: { contractId, userId },
      select: { id: true },
    });
    return signature !== null;
  }

  /**
   * Check if contract is fully signed
   */
  async isFullySigned(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contractV2.findUnique({
      where: { id: contractId },
      select: { clientUserId: true, freelancerUserId: true },
    });

    if (!contract) return false;

    const signatures = await this.prisma.contractSignature.findMany({
      where: { contractId },
      select: { userId: true },
    });

    const userIds = new Set(signatures.map((s) => s.userId));
    return userIds.has(contract.clientUserId) && userIds.has(contract.freelancerUserId);
  }

  /**
   * Get signature status for a contract
   */
  async getSignatureStatus(contractId: string): Promise<{
    clientSigned: boolean;
    freelancerSigned: boolean;
    clientSignedAt: Date | null;
    freelancerSignedAt: Date | null;
  }> {
    const contract = await this.prisma.contractV2.findUnique({
      where: { id: contractId },
      select: { clientUserId: true, freelancerUserId: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const signatures = await this.prisma.contractSignature.findMany({
      where: { contractId },
      select: { userId: true, createdAt: true },
    });

    const clientSignature = signatures.find((s) => s.userId === contract.clientUserId);
    const freelancerSignature = signatures.find((s) => s.userId === contract.freelancerUserId);

    return {
      clientSigned: !!clientSignature,
      freelancerSigned: !!freelancerSignature,
      clientSignedAt: clientSignature?.createdAt ?? null,
      freelancerSignedAt: freelancerSignature?.createdAt ?? null,
    };
  }

  /**
   * Verify signature hash
   */
  async verifySignature(id: string): Promise<{
    valid: boolean;
    signature: SignatureWithDetails | null;
  }> {
    const signature = await this.findById(id);
    if (!signature) {
      return { valid: false, signature: null };
    }

    // Regenerate hash and compare
    const expectedHash = this.generateSignatureHash({
      contractId: signature.contractId,
      userId: signature.userId,
      signerRole: signature.signerRole as 'CLIENT' | 'FREELANCER',
      signatureType: signature.signatureType,
      signatureImage: signature.signatureImage,
      signatureText: signature.signatureText,
      ipAddress: signature.ipAddress,
      userAgent: signature.userAgent,
      documentHash: signature.documentHash,
      documentVersion: signature.documentVersion,
      termsVersion: signature.termsVersion,
    });

    return {
      valid: signature.signatureHash === expectedHash,
      signature,
    };
  }

  /**
   * Generate signature hash
   */
  private generateSignatureHash(data: CreateSignatureInput): string {
    const hashInput = [
      data.contractId,
      data.userId,
      data.signatureType,
      data.signatureImage ?? '',
      data.signatureText ?? '',
      data.ipAddress,
      data.documentHash,
      data.documentVersion.toString(),
      new Date().toISOString(),
    ].join('|');

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Get all signatures by user
   */
  async getByUser(userId: string): Promise<
    (SignatureWithDetails & {
      contract: { id: string; title: string; contractNumber: string };
    })[]
  > {
    return this.prisma.contractSignature.findMany({
      where: { userId },
      include: {
        ...this.defaultInclude,
        contract: {
          select: {
            id: true,
            title: true,
            contractNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<
      (SignatureWithDetails & {
        contract: { id: string; title: string; contractNumber: string };
      })[]
    >;
  }
}
