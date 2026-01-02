// @ts-nocheck
/**
 * Code Review Assistant
 * AI-powered code review within SkillPod
 * Sprint M7: AI Work Assistant
 */

import { getLogger } from '@skillancer/logger';
import { getMetrics } from '@skillancer/metrics';

const logger = getLogger('code-review-assistant');
const metrics = getMetrics();

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'ruby'
  | 'php'
  | 'cpp'
  | 'csharp'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'other';

export type IssueCategory =
  | 'syntax'
  | 'best_practice'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'style'
  | 'logic'
  | 'maintainability';

export type IssueSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface CodeIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  suggestedFix?: string;
  documentation?: string;
}

export interface CodeReviewResult {
  issues: CodeIssue[];
  summary: ReviewSummary;
  suggestions: CodeSuggestion[];
  documentation?: GeneratedDocs;
}

export interface ReviewSummary {
  totalIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  byCategory: Record<IssueCategory, number>;
  overallQuality: number; // 0-100
  strengths: string[];
  areasToImprove: string[];
}

export interface CodeSuggestion {
  id: string;
  type: 'refactor' | 'simplify' | 'optimize' | 'modernize';
  title: string;
  description: string;
  originalCode: string;
  suggestedCode: string;
  lineStart: number;
  lineEnd: number;
  impact: 'low' | 'medium' | 'high';
}

export interface GeneratedDocs {
  summary: string;
  parameters?: DocParam[];
  returns?: string;
  examples?: string[];
}

export interface DocParam {
  name: string;
  type: string;
  description: string;
}

export interface ReviewRequest {
  code: string;
  language: SupportedLanguage;
  filename?: string;
  focusAreas?: IssueCategory[];
  generateDocs?: boolean;
}

// =============================================================================
// LANGUAGE RULES
// =============================================================================

const LANGUAGE_RULES: Record<SupportedLanguage, LanguageRules> = {
  javascript: {
    asyncPatterns: [/\.then\s*\(\s*function/, /callback\s*\(/],
    securityPatterns: [/eval\s*\(/, /innerHTML\s*=/, /dangerouslySetInnerHTML/],
    modernizationTips: [
      { pattern: /var\s+/, suggestion: 'Use const/let instead of var' },
      { pattern: /function\s*\(/, suggestion: 'Consider arrow functions' },
    ],
  },
  typescript: {
    asyncPatterns: [/\.then\s*\(\s*function/],
    securityPatterns: [/as\s+any/, /\/\/\s*@ts-ignore/, /eval\s*\(/],
    modernizationTips: [{ pattern: /any\s*[,\)\]]/, suggestion: 'Avoid using any type' }],
  },
  python: {
    asyncPatterns: [],
    securityPatterns: [/eval\s*\(/, /exec\s*\(/, /pickle\.loads/],
    modernizationTips: [{ pattern: /print\s+[^(]/, suggestion: 'Use print() function (Python 3)' }],
  },
  java: {
    asyncPatterns: [],
    securityPatterns: [/Runtime\.getRuntime\(\)\.exec/, /ProcessBuilder/],
    modernizationTips: [],
  },
  go: {
    asyncPatterns: [],
    securityPatterns: [/exec\.Command/, /os\.Exec/],
    modernizationTips: [],
  },
  ruby: {
    asyncPatterns: [],
    securityPatterns: [/eval\s*\(/, /system\s*\(/],
    modernizationTips: [],
  },
  php: {
    asyncPatterns: [],
    securityPatterns: [/eval\s*\(/, /\$_GET\[/, /\$_POST\[/, /shell_exec/],
    modernizationTips: [],
  },
  cpp: {
    asyncPatterns: [],
    securityPatterns: [/strcpy\s*\(/, /sprintf\s*\(/, /gets\s*\(/],
    modernizationTips: [],
  },
  csharp: {
    asyncPatterns: [],
    securityPatterns: [/Process\.Start/],
    modernizationTips: [],
  },
  rust: {
    asyncPatterns: [],
    securityPatterns: [/unsafe\s*{/],
    modernizationTips: [],
  },
  kotlin: {
    asyncPatterns: [],
    securityPatterns: [],
    modernizationTips: [],
  },
  swift: {
    asyncPatterns: [],
    securityPatterns: [],
    modernizationTips: [],
  },
  other: {
    asyncPatterns: [],
    securityPatterns: [],
    modernizationTips: [],
  },
};

interface LanguageRules {
  asyncPatterns: RegExp[];
  securityPatterns: RegExp[];
  modernizationTips: Array<{ pattern: RegExp; suggestion: string }>;
}

// =============================================================================
// CODE REVIEW ASSISTANT
// =============================================================================

export class CodeReviewAssistant {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  // ---------------------------------------------------------------------------
  // MAIN REVIEW
  // ---------------------------------------------------------------------------

  /**
   * Perform comprehensive code review
   */
  async reviewCode(request: ReviewRequest): Promise<CodeReviewResult> {
    const { code, language, focusAreas, generateDocs } = request;

    logger.info('Starting code review', { language, lines: code.split('\n').length });
    const startTime = Date.now();

    // Run static analysis
    const staticIssues = this.runStaticAnalysis(code, language);

    // Run AI-powered analysis
    const aiAnalysis = await this.runAIAnalysis(code, language, focusAreas);

    // Merge and deduplicate issues
    const allIssues = this.mergeIssues(staticIssues, aiAnalysis.issues);

    // Generate summary
    const summary = this.generateSummary(allIssues, code);

    // Get improvement suggestions
    const suggestions = await this.generateSuggestions(code, language, allIssues);

    // Generate documentation if requested
    let documentation: GeneratedDocs | undefined;
    if (generateDocs) {
      documentation = await this.generateDocumentation(code, language);
    }

    const duration = Date.now() - startTime;
    logger.info('Code review completed', { issues: allIssues.length, duration });
    metrics.histogram('code_review.duration', duration);
    metrics.increment('code_review.completed');

    return {
      issues: allIssues,
      summary,
      suggestions,
      documentation,
    };
  }

  // ---------------------------------------------------------------------------
  // STATIC ANALYSIS
  // ---------------------------------------------------------------------------

  private runStaticAnalysis(code: string, language: SupportedLanguage): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const rules = LANGUAGE_RULES[language] || LANGUAGE_RULES.other;
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check security patterns
      for (const pattern of rules.securityPatterns) {
        if (pattern.test(line)) {
          issues.push({
            id: `security-${lineNum}`,
            category: 'security',
            severity: 'warning',
            title: 'Potential security issue',
            description: `Pattern "${pattern.source}" detected which may pose security risks`,
            line: lineNum,
            suggestedFix: 'Review this code for security implications',
          });
        }
      }

      // Check modernization tips
      for (const tip of rules.modernizationTips) {
        if (tip.pattern.test(line)) {
          issues.push({
            id: `modern-${lineNum}`,
            category: 'best_practice',
            severity: 'info',
            title: 'Modernization opportunity',
            description: tip.suggestion,
            line: lineNum,
          });
        }
      }

      // Generic checks
      if (line.length > 120) {
        issues.push({
          id: `style-length-${lineNum}`,
          category: 'style',
          severity: 'hint',
          title: 'Long line',
          description: 'Line exceeds 120 characters',
          line: lineNum,
        });
      }

      // Check for TODO/FIXME
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
        issues.push({
          id: `todo-${lineNum}`,
          category: 'documentation',
          severity: 'info',
          title: 'TODO/FIXME comment',
          description: 'Action item found in code',
          line: lineNum,
        });
      }

      // Check for commented-out code (heuristic)
      if (/^\s*\/\/\s*(if|for|while|function|const|let|var|return)\s/.test(line)) {
        issues.push({
          id: `commented-${lineNum}`,
          category: 'maintainability',
          severity: 'hint',
          title: 'Commented-out code',
          description: 'Consider removing commented-out code',
          line: lineNum,
        });
      }
    });

    return issues;
  }

  // ---------------------------------------------------------------------------
  // AI ANALYSIS
  // ---------------------------------------------------------------------------

  private async runAIAnalysis(
    code: string,
    language: SupportedLanguage,
    focusAreas?: IssueCategory[]
  ): Promise<{ issues: CodeIssue[] }> {
    const prompt = this.buildReviewPrompt(code, language, focusAreas);

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getReviewerSystemPrompt(language),
      temperature: 0.3,
      maxTokens: 3000,
    });

    return this.parseAIReviewResponse(response);
  }

  private buildReviewPrompt(
    code: string,
    language: SupportedLanguage,
    focusAreas?: IssueCategory[]
  ): string {
    const focusStr = focusAreas?.length
      ? `Focus especially on: ${focusAreas.join(', ')}`
      : 'Review all aspects';

    return `
Review this ${language} code:

\`\`\`${language}
${code}
\`\`\`

${focusStr}

Identify issues in these categories:
1. Syntax errors
2. Best practice violations
3. Security vulnerabilities
4. Performance issues
5. Documentation needs
6. Code style
7. Logic errors
8. Maintainability concerns

For each issue, provide:
- Category
- Severity (error/warning/info/hint)
- Line number
- Description
- Suggested fix
`;
  }

  private getReviewerSystemPrompt(language: SupportedLanguage): string {
    return `You are an expert ${language} code reviewer with deep knowledge of:
- Language-specific best practices
- Security vulnerabilities (OWASP Top 10)
- Performance optimization
- Clean code principles
- Modern ${language} features and patterns

Provide specific, actionable feedback. Be constructive but thorough.
Reference line numbers when discussing issues.`;
  }

  private parseAIReviewResponse(response: string): { issues: CodeIssue[] } {
    // In production: Parse structured LLM output
    return { issues: [] };
  }

  // ---------------------------------------------------------------------------
  // SUMMARY & SUGGESTIONS
  // ---------------------------------------------------------------------------

  private generateSummary(issues: CodeIssue[], code: string): ReviewSummary {
    const bySeverity: Record<IssueSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
      hint: 0,
    };

    const byCategory: Partial<Record<IssueCategory, number>> = {};

    for (const issue of issues) {
      bySeverity[issue.severity]++;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    }

    // Calculate quality score (simplified)
    const errorWeight = 20;
    const warningWeight = 5;
    const penalty = bySeverity.error * errorWeight + bySeverity.warning * warningWeight;
    const linesOfCode = code.split('\n').filter((l) => l.trim()).length;
    const qualityScore = Math.max(0, 100 - penalty / Math.max(linesOfCode / 10, 1));

    return {
      totalIssues: issues.length,
      bySeverity,
      byCategory: byCategory as Record<IssueCategory, number>,
      overallQuality: Math.round(qualityScore),
      strengths: this.identifyStrengths(issues, code),
      areasToImprove: this.identifyImprovements(issues),
    };
  }

  private identifyStrengths(issues: CodeIssue[], code: string): string[] {
    const strengths: string[] = [];

    // Check what's NOT problematic
    const categories = new Set(issues.map((i) => i.category));

    if (!categories.has('security')) {
      strengths.push('No obvious security issues detected');
    }
    if (!categories.has('syntax')) {
      strengths.push('Code is syntactically correct');
    }
    if (code.includes('/**') || code.includes('///')) {
      strengths.push('Documentation comments present');
    }

    return strengths;
  }

  private identifyImprovements(issues: CodeIssue[]): string[] {
    const improvements: string[] = [];
    const categories = new Set(issues.map((i) => i.category));

    if (categories.has('security')) {
      improvements.push('Address security vulnerabilities');
    }
    if (categories.has('performance')) {
      improvements.push('Consider performance optimizations');
    }
    if (categories.has('best_practice')) {
      improvements.push('Follow language best practices');
    }

    return improvements;
  }

  private async generateSuggestions(
    code: string,
    language: SupportedLanguage,
    issues: CodeIssue[]
  ): Promise<CodeSuggestion[]> {
    // Generate refactoring suggestions based on issues
    const suggestions: CodeSuggestion[] = [];

    // In production: Use LLM to generate specific refactoring suggestions
    return suggestions;
  }

  // ---------------------------------------------------------------------------
  // DOCUMENTATION GENERATION
  // ---------------------------------------------------------------------------

  private async generateDocumentation(
    code: string,
    language: SupportedLanguage
  ): Promise<GeneratedDocs> {
    const prompt = `
Generate documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. A summary of what the code does
2. Parameter descriptions (if applicable)
3. Return value description (if applicable)
4. Usage examples
`;

    const response = await this.llmClient.generate({
      prompt,
      systemPrompt: `You are a technical documentation writer.
Create clear, concise documentation that helps developers understand the code.
Use proper formatting for the ${language} language.`,
      temperature: 0.3,
      maxTokens: 1000,
    });

    return this.parseDocumentationResponse(response);
  }

  private parseDocumentationResponse(response: string): GeneratedDocs {
    return {
      summary: response,
      parameters: [],
      examples: [],
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private mergeIssues(staticIssues: CodeIssue[], aiIssues: CodeIssue[]): CodeIssue[] {
    // Merge and deduplicate based on line number and category
    const seen = new Set<string>();
    const merged: CodeIssue[] = [];

    for (const issue of [...staticIssues, ...aiIssues]) {
      const key = `${issue.line}-${issue.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(issue);
      }
    }

    // Sort by severity then line number
    const severityOrder: Record<IssueSeverity, number> = {
      error: 0,
      warning: 1,
      info: 2,
      hint: 3,
    };

    return merged.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : a.line - b.line;
    });
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

let assistant: CodeReviewAssistant | null = null;

export function getCodeReviewAssistant(): CodeReviewAssistant {
  if (!assistant) {
    const mockLLM: LLMClient = {
      async generate(params) {
        return 'AI review placeholder';
      },
    };
    assistant = new CodeReviewAssistant(mockLLM);
  }
  return assistant;
}

