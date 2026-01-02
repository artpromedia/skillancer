// @ts-nocheck
/**
 * Writing Assistant
 * AI-powered writing assistance within SkillPod
 * Sprint M7: AI Work Assistant
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

const logger = getLogger('writing-assistant');
const metrics = getMetrics();

// =============================================================================
// TYPES
// =============================================================================

export type WritingMode = 'formal' | 'casual' | 'technical' | 'marketing' | 'academic';

export type SuggestionType =
  | 'grammar'
  | 'spelling'
  | 'punctuation'
  | 'clarity'
  | 'tone'
  | 'structure'
  | 'conciseness'
  | 'vocabulary'
  | 'seo';

export interface WritingSuggestion {
  id: string;
  type: SuggestionType;
  severity: 'critical' | 'important' | 'minor';
  original: string;
  replacement: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
  line: number;
}

export interface WritingAnalysis {
  score: number; // 0-100
  suggestions: WritingSuggestion[];
  metrics: TextMetrics;
  toneAnalysis: ToneAnalysis;
  readability: ReadabilityScore;
}

export interface TextMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageSentenceLength: number;
  averageWordLength: number;
  uniqueWords: number;
  vocabularyRichness: number;
}

export interface ToneAnalysis {
  detectedTone: string;
  confidence: number;
  toneBreakdown: Record<string, number>;
  matchesTarget: boolean;
  adjustments?: string[];
}

export interface ReadabilityScore {
  fleschKincaid: number;
  gradeLevel: number;
  readingTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RewriteOptions {
  targetTone?: WritingMode;
  shorterVersion?: boolean;
  longerVersion?: boolean;
  moreEngaging?: boolean;
  simplify?: boolean;
}

export interface RewriteResult {
  original: string;
  rewritten: string;
  changes: string[];
  improvementScore: number;
}

// =============================================================================
// WRITING RULES
// =============================================================================

const COMMON_MISTAKES: Array<{ pattern: RegExp; suggestion: string; type: SuggestionType }> = [
  // Grammar
  { pattern: /\bi\s/g, suggestion: 'I', type: 'grammar' },
  { pattern: /\bwould of\b/gi, suggestion: 'would have', type: 'grammar' },
  { pattern: /\bcould of\b/gi, suggestion: 'could have', type: 'grammar' },
  { pattern: /\bshould of\b/gi, suggestion: 'should have', type: 'grammar' },
  { pattern: /\bits\s+a\b/gi, suggestion: "it's a", type: 'grammar' },

  // Conciseness
  { pattern: /\bin order to\b/gi, suggestion: 'to', type: 'conciseness' },
  { pattern: /\bat this point in time\b/gi, suggestion: 'now', type: 'conciseness' },
  { pattern: /\bdue to the fact that\b/gi, suggestion: 'because', type: 'conciseness' },
  { pattern: /\bin the event that\b/gi, suggestion: 'if', type: 'conciseness' },
  { pattern: /\bfor the purpose of\b/gi, suggestion: 'to', type: 'conciseness' },

  // Clarity
  { pattern: /\bvery\s+unique\b/gi, suggestion: 'unique', type: 'clarity' },
  { pattern: /\babsolutely\s+essential\b/gi, suggestion: 'essential', type: 'clarity' },
];

const WEAK_WORDS = [
  'very',
  'really',
  'quite',
  'somewhat',
  'rather',
  'just',
  'actually',
  'basically',
];

// =============================================================================
// WRITING ASSISTANT
// =============================================================================

export class WritingAssistant {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  // ---------------------------------------------------------------------------
  // MAIN ANALYSIS
  // ---------------------------------------------------------------------------

  /**
   * Analyze text and provide suggestions
   */
  async analyzeText(text: string, mode: WritingMode = 'formal'): Promise<WritingAnalysis> {
    logger.info('Analyzing text', { length: text.length, mode });
    const startTime = Date.now();

    // Calculate text metrics
    const metrics = this.calculateMetrics(text);

    // Run local rule checks
    const localSuggestions = this.runLocalChecks(text);

    // Run AI-powered analysis
    const aiSuggestions = await this.runAIAnalysis(text, mode);

    // Merge suggestions
    const allSuggestions = [...localSuggestions, ...aiSuggestions];

    // Analyze tone
    const toneAnalysis = await this.analyzeTone(text, mode);

    // Calculate readability
    const readability = this.calculateReadability(text, metrics);

    // Calculate overall score
    const score = this.calculateScore(allSuggestions, toneAnalysis, readability);

    const duration = Date.now() - startTime;
    logger.info('Analysis completed', { suggestions: allSuggestions.length, duration });
    metrics.increment('writing_assistant.analysis_completed');

    return {
      score,
      suggestions: allSuggestions,
      metrics,
      toneAnalysis,
      readability,
    };
  }

  // ---------------------------------------------------------------------------
  // LOCAL CHECKS
  // ---------------------------------------------------------------------------

  private runLocalChecks(text: string): WritingSuggestion[] {
    const suggestions: WritingSuggestion[] = [];
    const lines = text.split('\n');
    let currentIndex = 0;

    lines.forEach((line, lineNum) => {
      // Check common mistakes
      for (const rule of COMMON_MISTAKES) {
        let match;
        while ((match = rule.pattern.exec(line)) !== null) {
          suggestions.push({
            id: `local-${lineNum}-${match.index}`,
            type: rule.type,
            severity: rule.type === 'grammar' ? 'critical' : 'minor',
            original: match[0],
            replacement: rule.suggestion,
            explanation: `Consider using "${rule.suggestion}" instead`,
            startIndex: currentIndex + match.index,
            endIndex: currentIndex + match.index + match[0].length,
            line: lineNum + 1,
          });
        }
        rule.pattern.lastIndex = 0; // Reset regex
      }

      // Check weak words
      for (const word of WEAK_WORDS) {
        const pattern = new RegExp(`\\b${word}\\b`, 'gi');
        let match;
        while ((match = pattern.exec(line)) !== null) {
          suggestions.push({
            id: `weak-${lineNum}-${match.index}`,
            type: 'vocabulary',
            severity: 'minor',
            original: match[0],
            replacement: '',
            explanation: `"${word}" is a weak word. Consider removing or using a stronger alternative.`,
            startIndex: currentIndex + match.index,
            endIndex: currentIndex + match.index + match[0].length,
            line: lineNum + 1,
          });
        }
      }

      // Check for passive voice (simplified)
      const passivePattern = /\b(was|were|been|being|is|are|am)\s+\w+ed\b/gi;
      let passiveMatch;
      while ((passiveMatch = passivePattern.exec(line)) !== null) {
        suggestions.push({
          id: `passive-${lineNum}-${passiveMatch.index}`,
          type: 'clarity',
          severity: 'minor',
          original: passiveMatch[0],
          replacement: '',
          explanation: 'Consider using active voice for clarity',
          startIndex: currentIndex + passiveMatch.index,
          endIndex: currentIndex + passiveMatch.index + passiveMatch[0].length,
          line: lineNum + 1,
        });
      }

      currentIndex += line.length + 1; // +1 for newline
    });

    return suggestions;
  }

  // ---------------------------------------------------------------------------
  // AI ANALYSIS
  // ---------------------------------------------------------------------------

  private async runAIAnalysis(text: string, mode: WritingMode): Promise<WritingSuggestion[]> {
    if (text.length < 50) {
      return []; // Too short for meaningful AI analysis
    }

    const prompt = `
Analyze this ${mode} text for improvements:

"""
${text.substring(0, 2000)}
"""

Check for:
1. Grammar and punctuation errors
2. Clarity issues
3. Tone inconsistencies (should be ${mode})
4. Structure improvements
5. SEO opportunities (if applicable)

For each issue, specify:
- Type of issue
- Original text
- Suggested replacement
- Brief explanation
`;

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getWritingSystemPrompt(mode),
      temperature: 0.3,
      maxTokens: 2000,
    });

    return this.parseAISuggestions(response);
  }

  private getWritingSystemPrompt(mode: WritingMode): string {
    const modeDescriptions: Record<WritingMode, string> = {
      formal: 'professional, polished, and business-appropriate',
      casual: 'friendly, conversational, and approachable',
      technical: 'precise, accurate, and detailed',
      marketing: 'engaging, persuasive, and action-oriented',
      academic: 'scholarly, well-researched, and properly cited',
    };

    return `You are an expert writing editor specializing in ${mode} writing.
The text should be ${modeDescriptions[mode]}.
Provide specific, actionable suggestions.
Be constructive and explain why each change improves the writing.`;
  }

  private parseAISuggestions(response: string): WritingSuggestion[] {
    // In production: Parse structured LLM output
    return [];
  }

  // ---------------------------------------------------------------------------
  // TONE ANALYSIS
  // ---------------------------------------------------------------------------

  private async analyzeTone(text: string, targetMode: WritingMode): Promise<ToneAnalysis> {
    // Simplified tone analysis (in production: use NLP or LLM)
    const wordChoiceScore = this.analyzeWordChoice(text, targetMode);

    return {
      detectedTone: targetMode,
      confidence: 0.75,
      toneBreakdown: {
        formal: 0.3,
        casual: 0.2,
        technical: 0.2,
        marketing: 0.15,
        academic: 0.15,
      },
      matchesTarget: wordChoiceScore > 0.6,
      adjustments:
        wordChoiceScore < 0.6 ? [`Consider adjusting tone to be more ${targetMode}`] : undefined,
    };
  }

  private analyzeWordChoice(text: string, mode: WritingMode): number {
    // Simple heuristic based on word patterns
    const textLower = text.toLowerCase();

    const formalIndicators = ['therefore', 'consequently', 'furthermore', 'regarding'];
    const casualIndicators = ['hey', 'awesome', 'cool', 'gonna'];
    const technicalIndicators = ['implement', 'algorithm', 'function', 'parameter'];
    const marketingIndicators = ['amazing', 'exclusive', 'limited', 'now'];

    const modeIndicators: Record<WritingMode, string[]> = {
      formal: formalIndicators,
      casual: casualIndicators,
      technical: technicalIndicators,
      marketing: marketingIndicators,
      academic: formalIndicators,
    };

    const indicators = modeIndicators[mode] || [];
    const matches = indicators.filter((word) => textLower.includes(word)).length;

    return Math.min(matches / 3, 1);
  }

  // ---------------------------------------------------------------------------
  // READABILITY
  // ---------------------------------------------------------------------------

  private calculateReadability(text: string, metrics: TextMetrics): ReadabilityScore {
    // Flesch-Kincaid Grade Level
    const avgSentenceLength = metrics.averageSentenceLength;
    const avgSyllables = this.estimateAverageSyllables(text);

    const fleschKincaid = 0.39 * avgSentenceLength + 11.8 * avgSyllables - 15.59;

    const gradeLevel = Math.max(1, Math.min(18, Math.round(fleschKincaid)));

    // Reading time (average 200 words/minute)
    const readingTime = Math.ceil(metrics.wordCount / 200);

    // Difficulty
    let difficulty: 'easy' | 'medium' | 'hard';
    if (gradeLevel <= 8) {
      difficulty = 'easy';
    } else if (gradeLevel <= 12) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }

    return {
      fleschKincaid,
      gradeLevel,
      readingTime,
      difficulty,
    };
  }

  private estimateAverageSyllables(text: string): number {
    const words = text.split(/\s+/);
    let totalSyllables = 0;

    for (const word of words) {
      totalSyllables += this.countSyllables(word);
    }

    return totalSyllables / Math.max(words.length, 1);
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    // Simple syllable counting heuristic
    const vowels = word.match(/[aeiouy]+/g);
    let count = vowels ? vowels.length : 1;

    // Adjust for silent e
    if (word.endsWith('e')) count--;

    return Math.max(1, count);
  }

  // ---------------------------------------------------------------------------
  // METRICS
  // ---------------------------------------------------------------------------

  private calculateMetrics(text: string): TextMetrics {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      averageSentenceLength: words.length / Math.max(sentences.length, 1),
      averageWordLength: totalChars / Math.max(words.length, 1),
      uniqueWords: uniqueWords.size,
      vocabularyRichness: uniqueWords.size / Math.max(words.length, 1),
    };
  }

  private calculateScore(
    suggestions: WritingSuggestion[],
    tone: ToneAnalysis,
    readability: ReadabilityScore
  ): number {
    let score = 100;

    // Deduct for suggestions
    const criticalCount = suggestions.filter((s) => s.severity === 'critical').length;
    const importantCount = suggestions.filter((s) => s.severity === 'important').length;
    const minorCount = suggestions.filter((s) => s.severity === 'minor').length;

    score -= criticalCount * 10;
    score -= importantCount * 5;
    score -= minorCount * 2;

    // Deduct for tone mismatch
    if (!tone.matchesTarget) {
      score -= 10;
    }

    // Adjust for readability extremes
    if (readability.difficulty === 'hard') {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ---------------------------------------------------------------------------
  // REWRITING
  // ---------------------------------------------------------------------------

  /**
   * Rewrite text with specified improvements
   */
  async rewriteText(text: string, options: RewriteOptions): Promise<RewriteResult> {
    logger.info('Rewriting text', { options });

    const instructions: string[] = [];

    if (options.targetTone) {
      instructions.push(`Adjust tone to be ${options.targetTone}`);
    }
    if (options.shorterVersion) {
      instructions.push('Make it more concise');
    }
    if (options.longerVersion) {
      instructions.push('Expand with more detail');
    }
    if (options.moreEngaging) {
      instructions.push('Make it more engaging and compelling');
    }
    if (options.simplify) {
      instructions.push('Simplify for easier understanding');
    }

    const prompt = `
Rewrite this text with the following changes:
${instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Original:
"""
${text}
"""

Provide the rewritten version.
`;

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt:
        'You are an expert editor. Rewrite the text as instructed while preserving the core message.',
      temperature: 0.6,
      maxTokens: Math.max(text.length * 2, 500),
    });

    metrics.increment('writing_assistant.rewrite_completed');

    return {
      original: text,
      rewritten: response,
      changes: instructions,
      improvementScore: 15, // Placeholder
    };
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

interface LLMClient {
  generate(params: {
    prompt: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  }): Promise<string>;
}

// =============================================================================
// FACTORY
// =============================================================================

let assistant: WritingAssistant | null = null;

export function getWritingAssistant(): WritingAssistant {
  if (!assistant) {
    const mockLLM: LLMClient = {
      async generate(params) {
        return 'AI rewrite placeholder';
      },
    };
    assistant = new WritingAssistant(mockLLM);
  }
  return assistant;
}

