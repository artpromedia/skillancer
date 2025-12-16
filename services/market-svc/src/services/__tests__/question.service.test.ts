/**
 * @module @skillancer/market-svc/services/__tests__/question
 * Unit tests for the question service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock ProjectService
vi.mock('../project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    getProject: vi.fn().mockResolvedValue({
      id: 'project-123',
      clientId: 'client-123',
      title: 'Test Project',
      status: 'PUBLISHED',
    }),
  })),
}));

// Mock QuestionRepository
const mockQuestionRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByProjectId: vi.fn(),
  findByAskerId: vi.fn(),
  answer: vi.fn(),
  update: vi.fn(),
  setPinned: vi.fn(),
  delete: vi.fn(),
  countByProject: vi.fn(),
  hasAskedRecently: vi.fn(),
};

vi.mock('../../repositories/question.repository.js', () => ({
  QuestionRepository: vi.fn().mockImplementation(() => mockQuestionRepository),
}));

// Create mock instances
const mockPrisma = {
  projectQuestion: {
    count: vi.fn(),
  },
} as any;

const mockRedis = {
  lpush: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { QuestionService } from '../question.service.js';
import { BiddingError, BiddingErrorCode } from '../../errors/bidding.errors.js';

describe('QuestionService', () => {
  let service: QuestionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.lpush.mockResolvedValue(1);
    service = new QuestionService(mockPrisma, mockRedis, mockLogger);
  });

  describe('askQuestion', () => {
    const validInput = {
      jobId: 'project-123',
      question: 'What is the expected timeline for this project?',
      isPublic: true,
    };

    it('should ask question successfully', async () => {
      mockQuestionRepository.countByProject.mockResolvedValue(5);
      mockQuestionRepository.hasAskedRecently.mockResolvedValue(false);
      mockPrisma.projectQuestion.count.mockResolvedValue(1);
      mockQuestionRepository.create.mockResolvedValue({
        id: 'question-123',
        ...validInput,
        askerId: 'freelancer-123',
        asker: { displayName: 'John Freelancer' },
      });

      const result = await service.askQuestion('freelancer-123', validInput);

      expect(result.id).toBe('question-123');
      expect(mockQuestionRepository.create).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'question:notifications',
        expect.stringContaining('QUESTION_ASKED')
      );
    });

    it('should reject question from project owner', async () => {
      await expect(service.askQuestion('client-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.VALIDATION_ERROR,
      });
    });

    it('should enforce project question limit', async () => {
      mockQuestionRepository.countByProject.mockResolvedValue(100);

      await expect(service.askQuestion('freelancer-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.QUESTION_LIMIT_REACHED,
      });
    });

    it('should enforce rate limit', async () => {
      mockQuestionRepository.countByProject.mockResolvedValue(5);
      mockQuestionRepository.hasAskedRecently.mockResolvedValue(true);

      await expect(service.askQuestion('freelancer-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.RATE_LIMITED,
      });
    });

    it('should enforce per-user question limit', async () => {
      mockQuestionRepository.countByProject.mockResolvedValue(5);
      mockQuestionRepository.hasAskedRecently.mockResolvedValue(false);
      mockPrisma.projectQuestion.count.mockResolvedValue(5);

      await expect(service.askQuestion('freelancer-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.QUESTION_LIMIT_REACHED,
      });
    });
  });

  describe('answerQuestion', () => {
    it('should answer question as project owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        jobId: 'project-123',
        askerId: 'freelancer-123',
        question: 'What is the timeline?',
        answer: null,
        job: { clientId: 'client-123', title: 'Test Project' },
      });

      await service.answerQuestion(
        { questionId: 'question-123', answer: 'We expect 2 weeks for completion.' },
        'client-123'
      );

      expect(mockQuestionRepository.answer).toHaveBeenCalledWith(
        'question-123',
        'We expect 2 weeks for completion.'
      );
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'question:notifications',
        expect.stringContaining('QUESTION_ANSWERED')
      );
    });

    it('should reject answer from non-owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        answer: null,
        job: { clientId: 'client-123' },
      });

      await expect(
        service.answerQuestion({ questionId: 'question-123', answer: 'Some answer' }, 'other-user')
      ).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });

    it('should reject answer to already answered question', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        answer: 'Already answered',
        job: { clientId: 'client-123' },
      });

      await expect(
        service.answerQuestion({ questionId: 'question-123', answer: 'New answer' }, 'client-123')
      ).rejects.toMatchObject({
        code: BiddingErrorCode.QUESTION_ALREADY_ANSWERED,
      });
    });
  });

  describe('updateQuestion', () => {
    it('should update question as asker', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        answer: null,
      });
      mockQuestionRepository.update.mockResolvedValue({
        id: 'question-123',
        question: 'Updated question?',
      });

      const result = await service.updateQuestion('question-123', 'freelancer-123', {
        question: 'Updated question?',
      });

      expect(mockQuestionRepository.update).toHaveBeenCalledWith('question-123', {
        question: 'Updated question?',
      });
    });

    it('should reject update from non-asker', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        answer: null,
      });

      await expect(
        service.updateQuestion('question-123', 'other-user', { question: 'New?' })
      ).rejects.toMatchObject({
        code: BiddingErrorCode.FORBIDDEN,
      });
    });

    it('should reject update of answered question', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        answer: 'Already answered',
      });

      await expect(
        service.updateQuestion('question-123', 'freelancer-123', { question: 'New?' })
      ).rejects.toMatchObject({
        code: BiddingErrorCode.VALIDATION_ERROR,
      });
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question as asker', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        job: { clientId: 'client-123' },
      });

      await service.deleteQuestion('question-123', 'freelancer-123');

      expect(mockQuestionRepository.delete).toHaveBeenCalledWith('question-123');
    });

    it('should delete question as project owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        job: { clientId: 'client-123' },
      });

      await service.deleteQuestion('question-123', 'client-123');

      expect(mockQuestionRepository.delete).toHaveBeenCalledWith('question-123');
    });

    it('should reject delete from unauthorized user', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        askerId: 'freelancer-123',
        job: { clientId: 'client-123' },
      });

      await expect(service.deleteQuestion('question-123', 'other-user')).rejects.toMatchObject({
        code: BiddingErrorCode.FORBIDDEN,
      });
    });
  });

  describe('togglePinQuestion', () => {
    it('should pin question as project owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        job: { clientId: 'client-123' },
      });

      await service.togglePinQuestion('question-123', 'client-123', true);

      expect(mockQuestionRepository.setPinned).toHaveBeenCalledWith('question-123', true);
    });

    it('should unpin question as project owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        job: { clientId: 'client-123' },
      });

      await service.togglePinQuestion('question-123', 'client-123', false);

      expect(mockQuestionRepository.setPinned).toHaveBeenCalledWith('question-123', false);
    });

    it('should reject pin from non-owner', async () => {
      mockQuestionRepository.findById.mockResolvedValue({
        id: 'question-123',
        job: { clientId: 'client-123' },
      });

      await expect(
        service.togglePinQuestion('question-123', 'other-user', true)
      ).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });
  });

  describe('getProjectQuestions', () => {
    it('should return public questions for anonymous users', async () => {
      mockQuestionRepository.findByProjectId.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            question: 'What is the timeline?',
            isPublic: true,
            asker: { id: 'f1', displayName: 'Freelancer' },
          },
        ],
        total: 10,
      });

      const result = await service.getProjectQuestions('project-123', undefined, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(mockQuestionRepository.findByProjectId).toHaveBeenCalledWith(
        'project-123',
        expect.objectContaining({ includePrivate: false })
      );
    });

    it('should include private questions for project owner', async () => {
      mockQuestionRepository.findByProjectId.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            question: 'What is the timeline?',
            isPublic: false,
            asker: { id: 'f1', displayName: 'Freelancer' },
          },
        ],
        total: 5,
      });

      const result = await service.getProjectQuestions('project-123', 'client-123', {
        page: 1,
        limit: 20,
      });

      expect(mockQuestionRepository.findByProjectId).toHaveBeenCalledWith(
        'project-123',
        expect.objectContaining({ includePrivate: true })
      );
    });
  });

  describe('getProjectQAStats', () => {
    it('should return Q&A statistics', async () => {
      mockQuestionRepository.countByProject
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(15); // answered

      const result = await service.getProjectQAStats('project-123');

      expect(result.totalQuestions).toBe(20);
      expect(result.answeredQuestions).toBe(15);
      expect(result.unansweredQuestions).toBe(5);
      expect(result.answerRate).toBe(75);
    });
  });
});
