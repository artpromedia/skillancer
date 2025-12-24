/**
 * @module @skillancer/analytics/events/skillpod
 * SkillPod learning platform event schemas
 */

import { z } from 'zod';
import { BaseEventSchema } from './base.js';

// ==================== Course Events ====================

export const CourseEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'course_viewed',
    'course_enrolled',
    'course_started',
    'course_completed',
    'course_dropped',
    'course_rated',
    'course_shared',
    'course_wishlisted',
  ]),
  properties: z.object({
    courseId: z.string(),
    courseTitle: z.string(),
    courseCategory: z.string(),
    courseSubcategory: z.string().optional(),
    instructorId: z.string().optional(),
    instructorName: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    duration: z.number().optional(), // minutes
    lessonCount: z.number().optional(),
    rating: z.number().optional(), // for course_rated (1-5)
    progress: z.number().optional(), // 0-100
    completionTime: z.number().optional(), // minutes to complete
    certificateEarned: z.boolean().optional(),
    viewSource: z.enum(['search', 'recommendation', 'category', 'direct', 'email']).optional(),
  }),
});

// ==================== Lesson Events ====================

export const LessonEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'lesson_started',
    'lesson_completed',
    'lesson_paused',
    'lesson_resumed',
    'lesson_skipped',
    'lesson_bookmarked',
    'lesson_note_added',
  ]),
  properties: z.object({
    lessonId: z.string(),
    lessonTitle: z.string(),
    lessonType: z.enum(['video', 'article', 'quiz', 'exercise', 'project', 'live']),
    courseId: z.string(),
    courseTitle: z.string(),
    moduleId: z.string().optional(),
    moduleName: z.string().optional(),
    lessonOrder: z.number(),
    duration: z.number().optional(),
    timeWatched: z.number().optional(),
    percentWatched: z.number().optional(),
    completionTime: z.number().optional(),
  }),
});

// ==================== Video Events ====================

export const VideoEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'video_play',
    'video_pause',
    'video_seek',
    'video_complete',
    'video_buffer',
    'video_quality_change',
    'video_speed_change',
    'video_fullscreen',
    'video_pip',
    'video_caption_toggle',
  ]),
  properties: z.object({
    videoId: z.string(),
    lessonId: z.string(),
    courseId: z.string(),
    position: z.number(), // seconds
    duration: z.number(), // total seconds
    percentComplete: z.number(),
    quality: z.string().optional(),
    playbackSpeed: z.number().optional(),
    seekFrom: z.number().optional(),
    seekTo: z.number().optional(),
    bufferDuration: z.number().optional(),
    isCaptionEnabled: z.boolean().optional(),
    captionLanguage: z.string().optional(),
  }),
});

// ==================== Assessment Events ====================

export const AssessmentEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'assessment_started',
    'assessment_submitted',
    'assessment_passed',
    'assessment_failed',
    'assessment_retried',
    'assessment_timed_out',
    'question_answered',
  ]),
  properties: z.object({
    assessmentId: z.string(),
    assessmentTitle: z.string(),
    assessmentType: z.enum(['quiz', 'exam', 'skill_assessment', 'certification', 'practice']),
    courseId: z.string().optional(),
    lessonId: z.string().optional(),
    skillId: z.string().optional(),
    skillName: z.string().optional(),
    questionCount: z.number(),
    correctAnswers: z.number().optional(),
    score: z.number().optional(),
    passingScore: z.number().optional(),
    timeSpent: z.number().optional(), // seconds
    timeLimit: z.number().optional(), // seconds
    attemptNumber: z.number(),
    proctored: z.boolean().optional(),
    questionId: z.string().optional(), // for question_answered
    questionType: z.string().optional(),
    isCorrect: z.boolean().optional(),
  }),
});

// ==================== Learning Path Events ====================

export const LearningPathEventSchema = BaseEventSchema.extend({
  eventType: z.enum(['path_started', 'path_milestone_reached', 'path_completed', 'path_abandoned']),
  properties: z.object({
    pathId: z.string(),
    pathTitle: z.string(),
    pathCategory: z.string().optional(),
    totalCourses: z.number(),
    completedCourses: z.number(),
    progress: z.number(), // 0-100
    milestoneId: z.string().optional(),
    milestoneName: z.string().optional(),
    estimatedDuration: z.number().optional(), // hours
    actualDuration: z.number().optional(), // hours
  }),
});

// ==================== Skill Events ====================

export const SkillEventSchema = BaseEventSchema.extend({
  eventType: z.enum(['skill_earned', 'skill_verified', 'skill_endorsed', 'skill_added_to_profile']),
  properties: z.object({
    skillId: z.string(),
    skillName: z.string(),
    skillCategory: z.string(),
    proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    verificationMethod: z.string().optional(),
    endorserId: z.string().optional(),
    endorserName: z.string().optional(),
    courseId: z.string().optional(),
    assessmentId: z.string().optional(),
  }),
});

export type CourseEvent = z.infer<typeof CourseEventSchema>;
export type LessonEvent = z.infer<typeof LessonEventSchema>;
export type VideoEvent = z.infer<typeof VideoEventSchema>;
export type AssessmentEvent = z.infer<typeof AssessmentEventSchema>;
export type LearningPathEvent = z.infer<typeof LearningPathEventSchema>;
export type SkillEvent = z.infer<typeof SkillEventSchema>;
