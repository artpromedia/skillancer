/**
 * Confluence Exporter Service
 * Creates and updates Confluence pages from PRD content using the Atlassian REST API
 */

import { logger } from '@skillancer/logger';
import type { PRDWithRelations } from '@skillancer/types';

const log = logger.child({ service: 'confluence-exporter' });

// Type definitions for PRD content
interface PRDGoal {
  goal: string;
  metric?: string;
  target?: string;
  priority?: string;
}

interface UserStory {
  as: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria?: string[];
  priority?: string;
}

interface PRDRequirement {
  type: string;
  description: string;
  priority?: string;
  category?: string;
}

interface SuccessMetric {
  metric: string;
  baseline?: string;
  target: string;
  source?: string;
}

interface PRDPhase {
  name: string;
  startDate?: string;
  endDate?: string;
  milestones?: Array<{ name: string; date?: string; status?: string }>;
}

interface PRDTimeline {
  phases: PRDPhase[];
}

export interface ConfluenceExportOptions {
  /** Confluence base URL (e.g., https://yoursite.atlassian.net/wiki) */
  baseUrl: string;
  /** User email for authentication */
  userEmail: string;
  /** API token or OAuth access token */
  apiToken: string;
  /** Space key where the page will be created */
  spaceKey: string;
  /** Parent page ID (optional, for hierarchical organization) */
  parentPageId?: string;
  /** Existing page ID to update */
  existingPageId?: string;
  /** Page labels/tags */
  labels?: string[];
  /** Whether to include comments */
  includeComments?: boolean;
}

export interface ConfluenceExportResult {
  /** The Confluence page ID */
  pageId: string;
  /** The Confluence page URL */
  url: string;
  /** The page version number */
  version: number;
  /** Whether this was a create or update operation */
  operation: 'created' | 'updated';
}

interface ConfluenceApiResponse {
  id: string;
  title: string;
  version: { number: number };
  _links: { webui: string; base: string };
}

export class ConfluenceExporter {
  /**
   * Export PRD to Confluence
   */
  async export(
    prd: PRDWithRelations,
    options: ConfluenceExportOptions
  ): Promise<ConfluenceExportResult> {
    log.info(
      { prdId: prd.id, spaceKey: options.spaceKey, hasExistingPage: !!options.existingPageId },
      'Starting Confluence export'
    );

    try {
      if (options.existingPageId) {
        return await this.updatePage(prd, options);
      } else {
        return await this.createPage(prd, options);
      }
    } catch (error) {
      log.error({ prdId: prd.id, error }, 'Confluence export failed');
      throw error;
    }
  }

  private async createPage(
    prd: PRDWithRelations,
    options: ConfluenceExportOptions
  ): Promise<ConfluenceExportResult> {
    const content = this.buildStorageFormat(prd, options);

    const body: Record<string, unknown> = {
      type: 'page',
      title: prd.title,
      space: { key: options.spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage',
        },
      },
    };

    // Add parent page if specified
    if (options.parentPageId) {
      body.ancestors = [{ id: options.parentPageId }];
    }

    const response = await this.makeRequest<ConfluenceApiResponse>(
      `${options.baseUrl}/rest/api/content`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      options
    );

    // Add labels if specified
    if (options.labels && options.labels.length > 0) {
      await this.addLabels(response.id, options.labels, options);
    }

    log.info({ prdId: prd.id, pageId: response.id }, 'Confluence page created');

    return {
      pageId: response.id,
      url: `${response._links.base}${response._links.webui}`,
      version: response.version.number,
      operation: 'created',
    };
  }

  private async updatePage(
    prd: PRDWithRelations,
    options: ConfluenceExportOptions
  ): Promise<ConfluenceExportResult> {
    const pageId = options.existingPageId!;

    // Get current page version
    const currentPage = await this.makeRequest<ConfluenceApiResponse>(
      `${options.baseUrl}/rest/api/content/${pageId}`,
      { method: 'GET' },
      options
    );

    const content = this.buildStorageFormat(prd, options);

    const body = {
      type: 'page',
      title: prd.title,
      body: {
        storage: {
          value: content,
          representation: 'storage',
        },
      },
      version: {
        number: currentPage.version.number + 1,
      },
    };

    const response = await this.makeRequest<ConfluenceApiResponse>(
      `${options.baseUrl}/rest/api/content/${pageId}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      options
    );

    // Update labels if specified
    if (options.labels && options.labels.length > 0) {
      await this.updateLabels(pageId, options.labels, options);
    }

    log.info({ prdId: prd.id, pageId: response.id, version: response.version.number }, 'Confluence page updated');

    return {
      pageId: response.id,
      url: `${response._links.base}${response._links.webui}`,
      version: response.version.number,
      operation: 'updated',
    };
  }

  private async addLabels(
    pageId: string,
    labels: string[],
    options: ConfluenceExportOptions
  ): Promise<void> {
    const body = labels.map((label) => ({ name: label }));

    await this.makeRequest(
      `${options.baseUrl}/rest/api/content/${pageId}/label`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      options
    );
  }

  private async updateLabels(
    pageId: string,
    labels: string[],
    options: ConfluenceExportOptions
  ): Promise<void> {
    // Remove existing labels first
    try {
      const existingLabels = await this.makeRequest<{ results: Array<{ name: string }> }>(
        `${options.baseUrl}/rest/api/content/${pageId}/label`,
        { method: 'GET' },
        options
      );

      for (const label of existingLabels.results) {
        await this.makeRequest(
          `${options.baseUrl}/rest/api/content/${pageId}/label/${encodeURIComponent(label.name)}`,
          { method: 'DELETE' },
          options
        );
      }
    } catch (error) {
      log.warn({ pageId, error }, 'Failed to remove existing labels');
    }

    // Add new labels
    await this.addLabels(pageId, labels, options);
  }

  private async makeRequest<T>(
    url: string,
    init: RequestInit,
    options: ConfluenceExportOptions
  ): Promise<T> {
    const auth = Buffer.from(`${options.userEmail}:${options.apiToken}`).toString('base64');

    const response = await fetch(url, {
      ...init,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
    }

    // Handle empty responses (e.g., DELETE requests)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Build Confluence Storage Format (XHTML-like markup)
   */
  private buildStorageFormat(prd: PRDWithRelations, options: ConfluenceExportOptions): string {
    const parts: string[] = [];

    // Cast JSON fields to proper types
    const goals = (prd.goals || []) as unknown as PRDGoal[];
    const userStories = (prd.userStories || []) as unknown as UserStory[];
    const requirements = (prd.requirements || []) as unknown as PRDRequirement[];
    const successMetrics = (prd.successMetrics || []) as unknown as SuccessMetric[];
    const timeline = prd.timeline as unknown as PRDTimeline | null;

    // Status panel
    parts.push(this.createStatusPanel(prd.status));

    // Metadata
    if (prd.engagement) {
      parts.push(`<p><strong>Engagement:</strong> ${this.escapeHtml(prd.engagement.title)}</p>`);
    }
    parts.push(`<p><strong>Last Updated:</strong> ${new Date(prd.updatedAt).toLocaleDateString()}</p>`);

    // Table of Contents
    parts.push(this.createTableOfContents());

    // Overview
    if (prd.overview) {
      parts.push(this.createSection('Overview', `<p>${this.escapeHtml(prd.overview)}</p>`));
    }

    // Problem Statement
    if (prd.problemStatement) {
      parts.push(this.createSection('Problem Statement', `<p>${this.escapeHtml(prd.problemStatement)}</p>`));
    }

    // Goals
    if (goals.length > 0) {
      parts.push(this.createGoalsSection(goals));
    }

    // User Stories
    if (userStories.length > 0) {
      parts.push(this.createUserStoriesSection(userStories));
    }

    // Requirements
    if (requirements.length > 0) {
      parts.push(this.createRequirementsSection(requirements));
    }

    // Success Metrics
    if (successMetrics.length > 0) {
      parts.push(this.createSuccessMetricsSection(successMetrics));
    }

    // Timeline
    if (timeline?.phases && timeline.phases.length > 0) {
      parts.push(this.createTimelineSection(timeline));
    }

    // Open Questions
    if (prd.openQuestions && prd.openQuestions.length > 0) {
      parts.push(this.createOpenQuestionsSection(prd.openQuestions));
    }

    // Appendix
    if (prd.appendix) {
      parts.push(this.createSection('Appendix', `<p>${this.escapeHtml(prd.appendix)}</p>`));
    }

    // Comments
    if (options.includeComments && prd.comments && prd.comments.length > 0) {
      parts.push(this.createCommentsSection(prd.comments));
    }

    return parts.join('\n');
  }

  private createTableOfContents(): string {
    return `
      <ac:structured-macro ac:name="toc">
        <ac:parameter ac:name="printable">true</ac:parameter>
        <ac:parameter ac:name="style">disc</ac:parameter>
        <ac:parameter ac:name="maxLevel">2</ac:parameter>
        <ac:parameter ac:name="minLevel">1</ac:parameter>
        <ac:parameter ac:name="type">list</ac:parameter>
      </ac:structured-macro>
      <hr />
    `;
  }

  private createStatusPanel(status: string): string {
    const statusConfig = this.getStatusConfig(status);
    return `
      <ac:structured-macro ac:name="panel">
        <ac:parameter ac:name="borderStyle">solid</ac:parameter>
        <ac:parameter ac:name="borderColor">${statusConfig.borderColor}</ac:parameter>
        <ac:parameter ac:name="bgColor">${statusConfig.bgColor}</ac:parameter>
        <ac:rich-text-body>
          <p><strong>Status:</strong>
            <ac:structured-macro ac:name="status">
              <ac:parameter ac:name="title">${status}</ac:parameter>
              <ac:parameter ac:name="colour">${statusConfig.color}</ac:parameter>
            </ac:structured-macro>
          </p>
        </ac:rich-text-body>
      </ac:structured-macro>
    `;
  }

  private createSection(title: string, content: string): string {
    return `
      <h1>${this.escapeHtml(title)}</h1>
      ${content}
    `;
  }

  private createGoalsSection(goals: PRDGoal[]): string {
    const items = goals.map((goal, index) => {
      let html = `<li><strong>${this.escapeHtml(goal.goal)}</strong>`;

      const details: string[] = [];
      if (goal.metric) details.push(`<em>Metric:</em> ${this.escapeHtml(goal.metric)}`);
      if (goal.target) details.push(`<em>Target:</em> ${this.escapeHtml(goal.target)}`);
      if (goal.priority) details.push(`<em>Priority:</em> ${goal.priority.toUpperCase()}`);

      if (details.length > 0) {
        html += `<ul>${details.map(d => `<li>${d}</li>`).join('')}</ul>`;
      }

      html += '</li>';
      return html;
    }).join('');

    return this.createSection('Goals', `<ol>${items}</ol>`);
  }

  private createUserStoriesSection(userStories: UserStory[]): string {
    const stories = userStories.map((story, index) => {
      let html = `
        <h2>Story ${index + 1}</h2>
        <ac:structured-macro ac:name="info">
          <ac:rich-text-body>
            <p>As a <strong>${this.escapeHtml(story.as)}</strong>,
               I want to <strong>${this.escapeHtml(story.iWant)}</strong>,
               so that <strong>${this.escapeHtml(story.soThat)}</strong>.</p>
          </ac:rich-text-body>
        </ac:structured-macro>
      `;

      if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
        html += `
          <p><strong>Acceptance Criteria:</strong></p>
          <ac:task-list>
            ${story.acceptanceCriteria.map(ac => `
              <ac:task>
                <ac:task-status>incomplete</ac:task-status>
                <ac:task-body>${this.escapeHtml(ac)}</ac:task-body>
              </ac:task>
            `).join('')}
          </ac:task-list>
        `;
      }

      if (story.priority) {
        html += `<p><em>Priority: ${this.escapeHtml(story.priority)}</em></p>`;
      }

      return html;
    }).join('');

    return `<h1>User Stories</h1>${stories}`;
  }

  private createRequirementsSection(requirements: PRDRequirement[]): string {
    const functional = requirements.filter(r => r.type === 'functional');
    const nonFunctional = requirements.filter(r => r.type === 'non-functional');

    let content = '';

    if (functional.length > 0) {
      content += `
        <h2>Functional Requirements</h2>
        <ul>${functional.map(r => this.formatRequirementItem(r)).join('')}</ul>
      `;
    }

    if (nonFunctional.length > 0) {
      content += `
        <h2>Non-Functional Requirements</h2>
        <ul>${nonFunctional.map(r => this.formatRequirementItem(r)).join('')}</ul>
      `;
    }

    return this.createSection('Requirements', content);
  }

  private formatRequirementItem(req: PRDRequirement): string {
    let text = this.escapeHtml(req.description);

    const badges: string[] = [];
    if (req.priority) {
      badges.push(`<ac:structured-macro ac:name="status">
        <ac:parameter ac:name="title">${req.priority.toUpperCase()}</ac:parameter>
        <ac:parameter ac:name="colour">${this.getPriorityColor(req.priority)}</ac:parameter>
      </ac:structured-macro>`);
    }
    if (req.category) {
      badges.push(`<em>[${this.escapeHtml(req.category)}]</em>`);
    }

    return `<li>${text} ${badges.join(' ')}</li>`;
  }

  private createSuccessMetricsSection(metrics: SuccessMetric[]): string {
    const rows = metrics.map(m => `
      <tr>
        <td>${this.escapeHtml(m.metric)}</td>
        <td>${this.escapeHtml(m.baseline || 'N/A')}</td>
        <td>${this.escapeHtml(m.target)}</td>
        <td>${this.escapeHtml(m.source || '-')}</td>
      </tr>
    `).join('');

    const table = `
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Baseline</th>
            <th>Target</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    return this.createSection('Success Metrics', table);
  }

  private createTimelineSection(timeline: PRDTimeline): string {
    const phases = timeline.phases.map((phase, index) => {
      let html = `<h2>Phase ${index + 1}: ${this.escapeHtml(phase.name)}</h2>`;

      if (phase.startDate || phase.endDate) {
        const dateRange = [phase.startDate, phase.endDate].filter(Boolean).join(' - ');
        html += `<p><strong>Duration:</strong> ${this.escapeHtml(dateRange)}</p>`;
      }

      if (phase.milestones && phase.milestones.length > 0) {
        html += `
          <p><strong>Milestones:</strong></p>
          <ac:task-list>
            ${phase.milestones.map(m => `
              <ac:task>
                <ac:task-status>${m.status === 'complete' ? 'complete' : 'incomplete'}</ac:task-status>
                <ac:task-body>${this.escapeHtml(m.name)}${m.date ? ` (${this.escapeHtml(m.date)})` : ''}</ac:task-body>
              </ac:task>
            `).join('')}
          </ac:task-list>
        `;
      }

      return html;
    }).join('');

    return `<h1>Timeline</h1>${phases}`;
  }

  private createOpenQuestionsSection(questions: string[]): string {
    const items = questions.map((q, i) => `<li>${this.escapeHtml(q)}</li>`).join('');
    return this.createSection('Open Questions', `
      <ac:structured-macro ac:name="warning">
        <ac:rich-text-body>
          <ol>${items}</ol>
        </ac:rich-text-body>
      </ac:structured-macro>
    `);
  }

  private createCommentsSection(comments: Array<{
    section: string;
    content: string;
    resolved: boolean;
    authorId: string;
    createdAt: Date;
  }>): string {
    const items = comments.map(comment => {
      const status = comment.resolved ? 'resolved' : 'open';
      const statusColor = comment.resolved ? 'Green' : 'Yellow';

      return `
        <ac:structured-macro ac:name="expand">
          <ac:parameter ac:name="title">[${this.escapeHtml(comment.section)}]
            <ac:structured-macro ac:name="status">
              <ac:parameter ac:name="title">${status}</ac:parameter>
              <ac:parameter ac:name="colour">${statusColor}</ac:parameter>
            </ac:structured-macro>
          </ac:parameter>
          <ac:rich-text-body>
            <p>${this.escapeHtml(comment.content)}</p>
            <p><em>Posted: ${new Date(comment.createdAt).toLocaleDateString()}</em></p>
          </ac:rich-text-body>
        </ac:structured-macro>
      `;
    }).join('');

    return this.createSection('Comments', items);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getStatusConfig(status: string): { color: string; bgColor: string; borderColor: string } {
    const configs: Record<string, { color: string; bgColor: string; borderColor: string }> = {
      DRAFT: { color: 'Grey', bgColor: '#f4f5f7', borderColor: '#dfe1e6' },
      REVIEW: { color: 'Yellow', bgColor: '#fff8e6', borderColor: '#ffe380' },
      APPROVED: { color: 'Green', bgColor: '#e3fcef', borderColor: '#57d9a3' },
      IN_DEVELOPMENT: { color: 'Blue', bgColor: '#deebff', borderColor: '#4c9aff' },
      SHIPPED: { color: 'Purple', bgColor: '#eae6ff', borderColor: '#998dd9' },
      ARCHIVED: { color: 'Grey', bgColor: '#f4f5f7', borderColor: '#dfe1e6' },
    };
    return configs[status] || configs.DRAFT;
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      p0: 'Red',
      p1: 'Yellow',
      p2: 'Blue',
      p3: 'Grey',
      high: 'Red',
      medium: 'Yellow',
      low: 'Blue',
    };
    return colors[priority.toLowerCase()] || 'Grey';
  }
}

export const confluenceExporter = new ConfluenceExporter();
