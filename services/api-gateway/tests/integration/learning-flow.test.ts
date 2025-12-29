import { describe, it, expect, beforeAll } from 'vitest';

// Learning System Integration Tests
// Tests the ML-powered learning recommendation pipeline

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface TestContext {
  accessToken: string;
  userId: string;
  learningPathId: string;
  assessmentId: string;
}

const ctx: TestContext = {
  accessToken: '',
  userId: '',
  learningPathId: '',
  assessmentId: '',
};

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(ctx.accessToken && { Authorization: `Bearer ${ctx.accessToken}` }),
      ...options.headers,
    },
  });
}

describe('Learning System Integration Flow', () => {
  beforeAll(async () => {
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'learner@test.com',
        password: 'TestPassword123!',
      }),
    });
    const loginData = await loginRes.json();
    ctx.accessToken = loginData.accessToken;
    ctx.userId = loginData.user.id;
  });

  describe('Market Signal Processing', () => {
    it('should track market activity signals', async () => {
      // Simulate job posting activity
      const res = await apiRequest('/api/learning/signals/market', {
        method: 'POST',
        body: JSON.stringify({
          signalType: 'job_posting_trend',
          data: {
            skill: 'rust',
            demandIncrease: 45,
            avgRate: 150,
            timeframe: '30d',
          },
        }),
      });
      expect(res.status).toBe(201);
    });

    it('should aggregate market signals', async () => {
      const res = await apiRequest('/api/learning/signals/aggregate');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.trendingSkills).toBeDefined();
      expect(Array.isArray(data.trendingSkills)).toBe(true);
    });

    it('should identify emerging skill demands', async () => {
      const res = await apiRequest('/api/learning/signals/emerging');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.emergingSkills).toBeDefined();
    });
  });

  describe('Skill Gap Detection', () => {
    it('should analyze user skill profile', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/skills`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.skills).toBeDefined();
      expect(data.proficiencyLevels).toBeDefined();
    });

    it('should detect skill gaps based on market demand', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/gaps`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.gaps).toBeDefined();
      expect(Array.isArray(data.gaps)).toBe(true);

      if (data.gaps.length > 0) {
        expect(data.gaps[0].skill).toBeDefined();
        expect(data.gaps[0].currentLevel).toBeDefined();
        expect(data.gaps[0].targetLevel).toBeDefined();
        expect(data.gaps[0].marketDemand).toBeDefined();
      }
    });

    it('should prioritize gaps by earning potential', async () => {
      const res = await apiRequest(
        `/api/learning/users/${ctx.userId}/gaps?sortBy=earningPotential`
      );
      expect(res.status).toBe(200);
      const data = await res.json();

      if (data.gaps.length > 1) {
        expect(data.gaps[0].earningPotential).toBeGreaterThanOrEqual(data.gaps[1].earningPotential);
      }
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate personalized recommendations', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/recommendations`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.recommendations).toBeDefined();
      expect(Array.isArray(data.recommendations)).toBe(true);
    });

    it('should include course recommendations', async () => {
      const res = await apiRequest(
        `/api/learning/users/${ctx.userId}/recommendations?type=courses`
      );
      expect(res.status).toBe(200);
      const data = await res.json();

      if (data.recommendations.length > 0) {
        expect(data.recommendations[0].type).toBe('course');
        expect(data.recommendations[0].provider).toBeDefined();
        expect(data.recommendations[0].estimatedDuration).toBeDefined();
      }
    });

    it('should include project recommendations', async () => {
      const res = await apiRequest(
        `/api/learning/users/${ctx.userId}/recommendations?type=projects`
      );
      expect(res.status).toBe(200);
      const data = await res.json();

      if (data.recommendations.length > 0) {
        expect(data.recommendations[0].type).toBe('project');
      }
    });
  });

  describe('Learning Path Creation', () => {
    it('should create a learning path', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/paths`, {
        method: 'POST',
        body: JSON.stringify({
          targetSkill: 'rust',
          targetLevel: 'intermediate',
          timeCommitment: 10, // hours per week
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.milestones).toBeDefined();
      ctx.learningPathId = data.id;
    });

    it('should have structured milestones', async () => {
      const res = await apiRequest(`/api/learning/paths/${ctx.learningPathId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.milestones.length).toBeGreaterThan(0);
      expect(data.milestones[0].title).toBeDefined();
      expect(data.milestones[0].resources).toBeDefined();
      expect(data.milestones[0].estimatedHours).toBeDefined();
    });

    it('should track learning progress', async () => {
      // Complete a milestone
      const pathRes = await apiRequest(`/api/learning/paths/${ctx.learningPathId}`);
      const pathData = await pathRes.json();
      const firstMilestone = pathData.milestones[0];

      const res = await apiRequest(
        `/api/learning/paths/${ctx.learningPathId}/milestones/${firstMilestone.id}/complete`,
        { method: 'POST' }
      );
      expect(res.status).toBe(200);

      // Check progress
      const progressRes = await apiRequest(`/api/learning/paths/${ctx.learningPathId}/progress`);
      const progressData = await progressRes.json();
      expect(progressData.completedMilestones).toBe(1);
      expect(progressData.progressPercentage).toBeGreaterThan(0);
    });
  });

  describe('Assessment System', () => {
    it('should create skill assessment', async () => {
      const res = await apiRequest('/api/learning/assessments', {
        method: 'POST',
        body: JSON.stringify({
          skill: 'rust',
          type: 'practical',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.questions).toBeDefined();
      ctx.assessmentId = data.id;
    });

    it('should submit assessment answers', async () => {
      // Get assessment questions
      const assessRes = await apiRequest(`/api/learning/assessments/${ctx.assessmentId}`);
      const assessData = await assessRes.json();

      // Submit answers
      const answers = assessData.questions.map((q: { id: string }, i: number) => ({
        questionId: q.id,
        answer: `Test answer ${i}`,
      }));

      const res = await apiRequest(`/api/learning/assessments/${ctx.assessmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.score).toBeDefined();
      expect(data.passed).toBeDefined();
    });

    it('should issue credential on passing', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/credentials`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.credentials)).toBe(true);
    });
  });

  describe('Analytics & Insights', () => {
    it('should provide learning analytics', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/analytics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalHoursLearned).toBeDefined();
      expect(data.skillsImproved).toBeDefined();
      expect(data.streakDays).toBeDefined();
    });

    it('should show earning impact of learning', async () => {
      const res = await apiRequest(`/api/learning/users/${ctx.userId}/impact`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.potentialRateIncrease).toBeDefined();
      expect(data.newJobOpportunities).toBeDefined();
    });
  });
});
