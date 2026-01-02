import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, TestClient } from '@skillancer/testing';

/**
 * Moat Services Integration Tests
 * Tests the competitive moat features across all services
 */

describe('Moat Services Integration', () => {
  let client: TestClient;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    client = await createTestClient();
    // Authenticate as test user
    const auth = await client.authenticate('test@example.com', 'TestPassword123!');
    authToken = auth.accessToken;
    userId = auth.user.id;
  });

  afterAll(async () => {
    await client.cleanup();
  });

  // ===========================================================================
  // Executive Suite Tests
  // ===========================================================================

  describe('Executive Suite (/api/executive)', () => {
    let executiveProfileId: string;
    let engagementId: string;

    describe('Executive Profile Management', () => {
      it('should create an executive profile', async () => {
        const response = await client.post('/api/executive/profiles', {
          executiveType: 'PREMIER',
          companyName: 'Acme Corp',
          industry: 'Technology',
          companySize: '51-200',
          annualBudget: 500000,
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.executiveType).toBe('PREMIER');
        executiveProfileId = response.data.id;
      });

      it('should get executive profile', async () => {
        const response = await client.get(`/api/executive/profiles/${executiveProfileId}`);

        expect(response.status).toBe(200);
        expect(response.data.companyName).toBe('Acme Corp');
      });

      it('should update executive profile', async () => {
        const response = await client.patch(`/api/executive/profiles/${executiveProfileId}`, {
          annualBudget: 750000,
          specialRequirements: 'NDA required for all engagements',
        });

        expect(response.status).toBe(200);
        expect(response.data.annualBudget).toBe(750000);
      });
    });

    describe('Executive Engagements', () => {
      it('should create an engagement', async () => {
        const response = await client.post('/api/executive/engagements', {
          executiveProfileId,
          freelancerIds: [userId],
          title: 'Platform Redesign Project',
          description: 'Complete redesign of the customer portal',
          billingType: 'FIXED',
          fixedAmount: 50000,
          startDate: new Date().toISOString(),
          ndaRequired: true,
          dedicatedSupport: true,
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('DRAFT');
        engagementId = response.data.id;
      });

      it('should list engagements', async () => {
        const response = await client.get('/api/executive/engagements');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
      });

      it('should update engagement status', async () => {
        const response = await client.patch(`/api/executive/engagements/${engagementId}`, {
          status: 'ACTIVE',
        });

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ACTIVE');
      });
    });

    describe('Integration Hub', () => {
      it('should list available integrations', async () => {
        const response = await client.get('/api/executive/integrations/available');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.some((i: any) => i.name === 'Slack')).toBe(true);
      });

      it('should get integration status', async () => {
        const response = await client.get('/api/executive/integrations');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Financial Services Tests
  // ===========================================================================

  describe('Financial Services (/api/financial)', () => {
    let cardId: string;
    let taxVaultId: string;

    describe('Skillancer Cards', () => {
      it('should apply for a virtual card', async () => {
        const response = await client.post('/api/financial/cards/apply', {
          cardType: 'VIRTUAL',
          cardName: 'Business Expenses',
          spendingLimit: 5000,
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('PENDING');
        cardId = response.data.id;
      });

      it('should list user cards', async () => {
        const response = await client.get('/api/financial/cards');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should get card details', async () => {
        const response = await client.get(`/api/financial/cards/${cardId}`);

        expect(response.status).toBe(200);
        expect(response.data.cardName).toBe('Business Expenses');
      });

      it('should get card transactions', async () => {
        const response = await client.get(`/api/financial/cards/${cardId}/transactions`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe('Tax Vault', () => {
      it('should create a tax vault', async () => {
        const response = await client.post('/api/financial/tax-vault', {
          name: 'Q1 2024 Taxes',
          withholdingRate: 0.25,
          autoWithhold: true,
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.withholdingRate).toBe(0.25);
        taxVaultId = response.data.id;
      });

      it('should get tax vault balance', async () => {
        const response = await client.get(`/api/financial/tax-vault/${taxVaultId}`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('balance');
      });

      it('should update withholding rate', async () => {
        const response = await client.patch(`/api/financial/tax-vault/${taxVaultId}`, {
          withholdingRate: 0.30,
        });

        expect(response.status).toBe(200);
        expect(response.data.withholdingRate).toBe(0.30);
      });
    });

    describe('Invoice Financing', () => {
      it('should get financing eligibility', async () => {
        const response = await client.get('/api/financial/financing/eligibility');

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('eligible');
        expect(response.data).toHaveProperty('maxAmount');
      });

      it('should list financing applications', async () => {
        const response = await client.get('/api/financial/financing');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe('Financial Summary', () => {
      it('should get financial summary', async () => {
        const response = await client.get('/api/financial/summary', {
          params: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('totalEarnings');
        expect(response.data).toHaveProperty('totalExpenses');
        expect(response.data).toHaveProperty('taxWithheld');
      });
    });
  });

  // ===========================================================================
  // Talent Graph Tests
  // ===========================================================================

  describe('Talent Graph (/api/talent-graph)', () => {
    let relationshipId: string;
    let introductionId: string;

    describe('Work Relationships', () => {
      it('should create a work relationship', async () => {
        const response = await client.post('/api/talent-graph/relationships', {
          connectedUserId: 'user-456',
          relationshipType: 'COLLABORATED',
          strength: 'STRONG',
          skills: ['React', 'TypeScript'],
          notes: 'Worked together on e-commerce project',
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        relationshipId = response.data.id;
      });

      it('should get connections', async () => {
        const response = await client.get('/api/talent-graph/connections');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should get extended network', async () => {
        const response = await client.get('/api/talent-graph/connections', {
          params: { depth: 2 },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should endorse a relationship', async () => {
        const response = await client.post(`/api/talent-graph/relationships/${relationshipId}/endorse`, {
          endorsement: 'Excellent collaborator, highly skilled in frontend development',
          skills: ['React'],
        });

        expect(response.status).toBe(200);
      });
    });

    describe('Warm Introductions', () => {
      it('should request an introduction', async () => {
        const response = await client.post('/api/talent-graph/introductions', {
          targetUserId: 'user-789',
          connectorUserId: 'user-456',
          purpose: 'Looking for React developers for upcoming project',
          urgency: 'NORMAL',
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('PENDING');
        introductionId = response.data.id;
      });

      it('should list pending introductions', async () => {
        const response = await client.get('/api/talent-graph/introductions', {
          params: { status: 'PENDING' },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should find path to user', async () => {
        const response = await client.get('/api/talent-graph/path', {
          params: { targetUserId: 'user-999' },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('path');
        expect(response.data).toHaveProperty('degrees');
      });
    });

    describe('Team Reunions', () => {
      it('should propose a team reunion', async () => {
        const response = await client.post('/api/talent-graph/reunions', {
          name: 'E-commerce Project Team',
          description: 'Reuniting the team for a new project',
          invitedUserIds: ['user-456', 'user-789'],
          requiredSkills: ['React', 'Node.js', 'PostgreSQL'],
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.status).toBe('PROPOSED');
      });

      it('should list reunions', async () => {
        const response = await client.get('/api/talent-graph/reunions');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe('Recommendations', () => {
      it('should get collaboration recommendations', async () => {
        const response = await client.get('/api/talent-graph/recommendations', {
          params: {
            purpose: 'COLLABORATION',
            skills: ['React', 'TypeScript'],
          },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Intelligence Service Tests
  // ===========================================================================

  describe('Outcome Intelligence (/api/intelligence)', () => {
    let outcomeId: string;

    describe('Outcome Tracking', () => {
      it('should record an engagement outcome', async () => {
        const response = await client.post('/api/intelligence/outcomes', {
          engagementId: 'eng-123',
          outcomeType: 'ON_TIME',
          completedAt: new Date().toISOString(),
          actualDuration: 30,
          estimatedDuration: 30,
          clientSatisfactionScore: 5,
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        outcomeId = response.data.id;
      });

      it('should get outcome history', async () => {
        const response = await client.get('/api/intelligence/outcomes');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe('Success Predictions', () => {
      it('should get success prediction for engagement', async () => {
        const response = await client.post('/api/intelligence/predictions', {
          engagementId: 'eng-123',
          predictionType: 'SUCCESS_PROBABILITY',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('prediction');
        expect(response.data).toHaveProperty('confidence');
        expect(response.data.prediction).toBeGreaterThanOrEqual(0);
        expect(response.data.prediction).toBeLessThanOrEqual(1);
      });

      it('should get completion time prediction', async () => {
        const response = await client.post('/api/intelligence/predictions', {
          freelancerId: userId,
          predictionType: 'COMPLETION_TIME',
          context: {
            skills: ['React', 'Node.js'],
            complexity: 'MEDIUM',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('prediction');
      });
    });

    describe('Risk Alerts', () => {
      it('should get active risk alerts', async () => {
        const response = await client.get('/api/intelligence/alerts', {
          params: { status: 'ACTIVE' },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should acknowledge risk alert', async () => {
        // First create an alert (if admin)
        const alertsResponse = await client.get('/api/intelligence/alerts');
        if (alertsResponse.data.length > 0) {
          const alertId = alertsResponse.data[0].id;
          const response = await client.patch(`/api/intelligence/alerts/${alertId}`, {
            status: 'ACKNOWLEDGED',
          });

          expect(response.status).toBe(200);
          expect(response.data.status).toBe('ACKNOWLEDGED');
        }
      });
    });

    describe('Market Benchmarks', () => {
      it('should get rate benchmarks', async () => {
        const response = await client.get('/api/intelligence/benchmarks', {
          params: {
            category: 'RATE',
            skills: ['React', 'TypeScript'],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('p25');
        expect(response.data).toHaveProperty('median');
        expect(response.data).toHaveProperty('p75');
      });

      it('should compare to benchmark', async () => {
        const response = await client.post('/api/intelligence/benchmarks/compare', {
          category: 'RATE',
          value: 85,
          skills: ['React', 'TypeScript'],
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('percentile');
        expect(response.data).toHaveProperty('position');
      });
    });

    describe('Insights', () => {
      it('should get personalized insights', async () => {
        const response = await client.get('/api/intelligence/insights');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should generate insight report', async () => {
        const response = await client.post('/api/intelligence/insights/report', {
          reportType: 'MONTHLY',
          format: 'JSON',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('insights');
        expect(response.data).toHaveProperty('recommendations');
      });
    });
  });

  // ===========================================================================
  // AI Copilot Tests
  // ===========================================================================

  describe('AI Copilot (/api/copilot)', () => {
    let draftId: string;

    describe('Proposal Drafts', () => {
      it('should generate a proposal draft', async () => {
        const response = await client.post('/api/copilot/proposals/draft', {
          jobId: 'job-123',
          jobTitle: 'Senior React Developer',
          jobDescription: 'Looking for an experienced React developer to build a dashboard',
          requiredSkills: ['React', 'TypeScript', 'Redux'],
          userSkills: ['React', 'TypeScript', 'Redux', 'Node.js'],
          clientName: 'John Smith',
          tone: 'PROFESSIONAL',
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('draftId');
        expect(response.data).toHaveProperty('content');
        expect(response.data).toHaveProperty('suggestedRate');
        expect(response.data).toHaveProperty('estimatedWinRate');
        draftId = response.data.draftId;
      });

      it('should get proposal draft', async () => {
        const response = await client.get(`/api/copilot/proposals/draft/${draftId}`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('content');
      });

      it('should update proposal draft', async () => {
        const response = await client.patch(`/api/copilot/proposals/draft/${draftId}`, {
          content: 'Updated proposal content...',
        });

        expect(response.status).toBe(200);
      });

      it('should list user drafts', async () => {
        const response = await client.get('/api/copilot/proposals/drafts');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe('Rate Suggestions', () => {
      it('should suggest rate', async () => {
        const response = await client.post('/api/copilot/rates/suggest', {
          skills: ['React', 'TypeScript', 'Node.js'],
          experience: 5,
          projectComplexity: 'HIGH',
          industry: 'FinTech',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('suggestedHourlyRate');
        expect(response.data.suggestedHourlyRate).toHaveProperty('min');
        expect(response.data.suggestedHourlyRate).toHaveProperty('max');
        expect(response.data.suggestedHourlyRate).toHaveProperty('optimal');
        expect(response.data).toHaveProperty('marketPosition');
        expect(response.data).toHaveProperty('factors');
      });
    });

    describe('Message Assist', () => {
      it('should assist with message', async () => {
        const response = await client.post('/api/copilot/messages/assist', {
          conversationContext: [
            'Hi, I saw your proposal for the dashboard project.',
            'I had a few questions about the timeline.',
          ],
          intent: 'CLARIFY',
          tone: 'PROFESSIONAL',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('suggestedMessage');
        expect(response.data).toHaveProperty('alternativeVersions');
      });
    });

    describe('Profile Optimization', () => {
      it('should optimize profile', async () => {
        const response = await client.post('/api/copilot/profile/optimize', {
          currentHeadline: 'Web Developer',
          currentSummary: 'I build websites',
          skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
          experience: [
            { title: 'Senior Developer', company: 'Tech Co', duration: '3 years' },
          ],
          targetRoles: ['Full Stack Developer', 'Technical Lead'],
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('optimizedHeadline');
        expect(response.data).toHaveProperty('optimizedSummary');
        expect(response.data).toHaveProperty('skillsToHighlight');
        expect(response.data).toHaveProperty('completenessScore');
      });
    });

    describe('Market Insights', () => {
      it('should get market insights', async () => {
        const response = await client.post('/api/copilot/market/insights', {
          skills: ['React', 'TypeScript'],
          industry: 'E-commerce',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('demandLevel');
        expect(response.data).toHaveProperty('demandTrend');
        expect(response.data).toHaveProperty('averageRate');
        expect(response.data).toHaveProperty('competitionLevel');
      });
    });

    describe('Interaction History', () => {
      it('should get copilot history', async () => {
        const response = await client.get('/api/copilot/history');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it('should filter history by type', async () => {
        const response = await client.get('/api/copilot/history', {
          params: { type: 'PROPOSAL_DRAFT' },
        });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // Cross-Service Integration Tests
  // ===========================================================================

  describe('Cross-Service Integration', () => {
    it('should trigger notification on engagement creation', async () => {
      const engagementResponse = await client.post('/api/executive/engagements', {
        executiveProfileId: 'profile-123',
        freelancerIds: [userId],
        title: 'Cross-Service Test Project',
        description: 'Testing notification integration',
        billingType: 'HOURLY',
        hourlyRate: 100,
        startDate: new Date().toISOString(),
      });

      // Check notification was created
      const notificationsResponse = await client.get('/api/notifications/history', {
        params: { limit: 5 },
      });

      expect(notificationsResponse.status).toBe(200);
      // Latest notification should be about engagement
      if (notificationsResponse.data.length > 0) {
        expect(
          notificationsResponse.data.some((n: any) =>
            n.type.includes('ENGAGEMENT') || n.type.includes('CONTRACT')
          )
        ).toBe(true);
      }
    });

    it('should update talent graph on engagement completion', async () => {
      // Complete an engagement
      await client.patch('/api/executive/engagements/eng-123', {
        status: 'COMPLETED',
      });

      // Check relationship was created/updated
      const connectionsResponse = await client.get('/api/talent-graph/connections');

      expect(connectionsResponse.status).toBe(200);
    });

    it('should use intelligence predictions in copilot suggestions', async () => {
      const rateResponse = await client.post('/api/copilot/rates/suggest', {
        skills: ['React'],
        experience: 5,
      });

      // Rate suggestion should include market data from intelligence service
      expect(rateResponse.data).toHaveProperty('competitorRange');
      expect(rateResponse.data.factors.length).toBeGreaterThan(0);
    });
  });
});
