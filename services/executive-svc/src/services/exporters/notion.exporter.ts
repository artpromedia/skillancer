/**
 * Notion Exporter Service
 * Creates and updates Notion pages from PRD content using the official Notion SDK
 */

import { Client } from '@notionhq/client';
import type {
  CreatePageParameters,
  BlockObjectRequest,
} from '@notionhq/client/build/src/api-endpoints';
import { logger } from '@skillancer/logger';
import type { PRDWithRelations } from '@skillancer/types';

// Define RichTextItemRequest type based on Notion API structure
type RichTextItemRequest = {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

const log = logger.child({ service: 'notion-exporter' });

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

export interface NotionExportOptions {
  /** Notion API token (integration token or OAuth token) */
  accessToken: string;
  /** Parent page ID where the PRD will be created */
  parentPageId?: string;
  /** Parent database ID if exporting to a database */
  parentDatabaseId?: string;
  /** Existing page ID to update (for updates instead of creates) */
  existingPageId?: string;
  /** Whether to include comments in the export */
  includeComments?: boolean;
  /** Custom icon for the page */
  icon?: string;
  /** Custom cover image URL */
  coverUrl?: string;
}

export interface NotionExportResult {
  /** The Notion page ID */
  pageId: string;
  /** The Notion page URL */
  url: string;
  /** Whether this was a create or update operation */
  operation: 'created' | 'updated';
}

export class NotionExporter {
  /**
   * Export PRD to Notion
   */
  async export(prd: PRDWithRelations, options: NotionExportOptions): Promise<NotionExportResult> {
    log.info({ prdId: prd.id, hasExistingPage: !!options.existingPageId }, 'Starting Notion export');

    const notion = new Client({ auth: options.accessToken });

    try {
      if (options.existingPageId) {
        return await this.updatePage(notion, prd, options);
      } else {
        return await this.createPage(notion, prd, options);
      }
    } catch (error) {
      log.error({ prdId: prd.id, error }, 'Notion export failed');
      throw error;
    }
  }

  private async createPage(
    notion: Client,
    prd: PRDWithRelations,
    options: NotionExportOptions
  ): Promise<NotionExportResult> {
    const blocks = this.buildBlocks(prd, options);

    const pageParams: CreatePageParameters = {
      parent: options.parentDatabaseId
        ? { database_id: options.parentDatabaseId }
        : { page_id: options.parentPageId! },
      properties: this.buildProperties(prd, options),
      children: blocks,
    };

    // Add icon if specified
    if (options.icon) {
      pageParams.icon = { type: 'emoji', emoji: options.icon as CreatePageParameters['icon'] extends { emoji: infer E } ? E : never };
    }

    // Add cover if specified
    if (options.coverUrl) {
      pageParams.cover = { type: 'external', external: { url: options.coverUrl } };
    }

    const response = await notion.pages.create(pageParams);

    log.info({ prdId: prd.id, pageId: response.id }, 'Notion page created');

    return {
      pageId: response.id,
      url: (response as { url: string }).url,
      operation: 'created',
    };
  }

  private async updatePage(
    notion: Client,
    prd: PRDWithRelations,
    options: NotionExportOptions
  ): Promise<NotionExportResult> {
    const pageId = options.existingPageId!;

    // Update page properties
    await notion.pages.update({
      page_id: pageId,
      properties: this.buildProperties(prd, options),
    });

    // Get existing blocks and delete them
    const existingBlocks = await notion.blocks.children.list({ block_id: pageId });
    for (const block of existingBlocks.results) {
      await notion.blocks.delete({ block_id: block.id });
    }

    // Add new blocks
    const blocks = this.buildBlocks(prd, options);

    // Notion API limits to 100 blocks per request
    const chunkSize = 100;
    for (let i = 0; i < blocks.length; i += chunkSize) {
      const chunk = blocks.slice(i, i + chunkSize);
      await notion.blocks.children.append({
        block_id: pageId,
        children: chunk,
      });
    }

    const page = await notion.pages.retrieve({ page_id: pageId });

    log.info({ prdId: prd.id, pageId }, 'Notion page updated');

    return {
      pageId,
      url: (page as { url: string }).url,
      operation: 'updated',
    };
  }

  private buildProperties(
    prd: PRDWithRelations,
    _options: NotionExportOptions
  ): CreatePageParameters['properties'] {
    // For database items, we need to match the database schema
    // For pages, we just need a title
    return {
      title: {
        title: [{ type: 'text', text: { content: prd.title } }],
      },
    };
  }

  private buildBlocks(prd: PRDWithRelations, options: NotionExportOptions): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = [];

    // Cast JSON fields to proper types
    const goals = (prd.goals || []) as unknown as PRDGoal[];
    const userStories = (prd.userStories || []) as unknown as UserStory[];
    const requirements = (prd.requirements || []) as unknown as PRDRequirement[];
    const successMetrics = (prd.successMetrics || []) as unknown as SuccessMetric[];
    const timeline = prd.timeline as unknown as PRDTimeline | null;

    // Status callout
    blocks.push(this.createCallout(`Status: ${prd.status}`, this.getStatusEmoji(prd.status)));

    // Metadata
    if (prd.engagement) {
      blocks.push(
        this.createParagraph([
          this.richText('Engagement: ', { bold: true }),
          this.richText(prd.engagement.title),
        ])
      );
    }

    blocks.push(this.createDivider());

    // Table of Contents
    blocks.push(this.createTableOfContents());
    blocks.push(this.createDivider());

    // Overview
    if (prd.overview) {
      blocks.push(this.createHeading1('Overview'));
      blocks.push(this.createParagraph(prd.overview));
      blocks.push(this.createDivider());
    }

    // Problem Statement
    if (prd.problemStatement) {
      blocks.push(this.createHeading1('Problem Statement'));
      blocks.push(this.createParagraph(prd.problemStatement));
      blocks.push(this.createDivider());
    }

    // Goals
    if (goals.length > 0) {
      blocks.push(this.createHeading1('Goals'));
      goals.forEach((goal, index) => {
        blocks.push(
          this.createNumberedListItem([
            this.richText(goal.goal, { bold: true }),
          ])
        );

        if (goal.metric) {
          blocks.push(
            this.createBulletedListItem([
              this.richText('Metric: ', { bold: true }),
              this.richText(goal.metric),
            ])
          );
        }
        if (goal.target) {
          blocks.push(
            this.createBulletedListItem([
              this.richText('Target: ', { bold: true }),
              this.richText(goal.target),
            ])
          );
        }
        if (goal.priority) {
          blocks.push(
            this.createBulletedListItem([
              this.richText('Priority: ', { bold: true }),
              this.richText(goal.priority.toUpperCase()),
            ])
          );
        }
      });
      blocks.push(this.createDivider());
    }

    // User Stories
    if (userStories.length > 0) {
      blocks.push(this.createHeading1('User Stories'));

      userStories.forEach((story, index) => {
        blocks.push(this.createHeading2(`Story ${index + 1}`));
        blocks.push(
          this.createQuote([
            this.richText(`As a ${story.as}, I want to ${story.iWant}, so that ${story.soThat}.`),
          ])
        );

        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          blocks.push(
            this.createParagraph([this.richText('Acceptance Criteria:', { bold: true })])
          );
          story.acceptanceCriteria.forEach((criterion) => {
            blocks.push(this.createToDo(criterion, false));
          });
        }

        if (story.priority) {
          blocks.push(
            this.createParagraph([
              this.richText('Priority: ', { bold: true }),
              this.richText(story.priority),
            ])
          );
        }
      });
      blocks.push(this.createDivider());
    }

    // Requirements
    if (requirements.length > 0) {
      blocks.push(this.createHeading1('Requirements'));

      const functional = requirements.filter((r) => r.type === 'functional');
      const nonFunctional = requirements.filter((r) => r.type === 'non-functional');

      if (functional.length > 0) {
        blocks.push(this.createHeading2('Functional Requirements'));
        functional.forEach((req) => {
          const text = this.formatRequirement(req);
          blocks.push(this.createBulletedListItem([this.richText(text)]));
        });
      }

      if (nonFunctional.length > 0) {
        blocks.push(this.createHeading2('Non-Functional Requirements'));
        nonFunctional.forEach((req) => {
          const text = this.formatRequirement(req);
          blocks.push(this.createBulletedListItem([this.richText(text)]));
        });
      }
      blocks.push(this.createDivider());
    }

    // Success Metrics
    if (successMetrics.length > 0) {
      blocks.push(this.createHeading1('Success Metrics'));
      blocks.push(this.createTable(successMetrics));
      blocks.push(this.createDivider());
    }

    // Timeline
    if (timeline?.phases && timeline.phases.length > 0) {
      blocks.push(this.createHeading1('Timeline'));

      timeline.phases.forEach((phase, index) => {
        blocks.push(this.createHeading2(`Phase ${index + 1}: ${phase.name}`));

        if (phase.startDate || phase.endDate) {
          const dateRange = [phase.startDate, phase.endDate].filter(Boolean).join(' - ');
          blocks.push(
            this.createParagraph([
              this.richText('Duration: ', { bold: true }),
              this.richText(dateRange),
            ])
          );
        }

        if (phase.milestones && phase.milestones.length > 0) {
          blocks.push(this.createParagraph([this.richText('Milestones:', { bold: true })]));
          phase.milestones.forEach((milestone) => {
            let text = milestone.name;
            if (milestone.date) text += ` (${milestone.date})`;

            const isComplete = milestone.status === 'complete';
            blocks.push(this.createToDo(text, isComplete));
          });
        }
      });
      blocks.push(this.createDivider());
    }

    // Open Questions
    if (prd.openQuestions && prd.openQuestions.length > 0) {
      blocks.push(this.createHeading1('Open Questions'));
      prd.openQuestions.forEach((question: string) => {
        blocks.push(this.createNumberedListItem([this.richText(question)]));
      });
      blocks.push(this.createDivider());
    }

    // Appendix
    if (prd.appendix) {
      blocks.push(this.createHeading1('Appendix'));
      blocks.push(this.createParagraph(prd.appendix));
    }

    // Comments section
    if (options.includeComments && prd.comments && prd.comments.length > 0) {
      blocks.push(this.createDivider());
      blocks.push(this.createHeading1('Comments'));

      prd.comments.forEach((comment: { section: string; content: string; resolved: boolean }) => {
        blocks.push(
          this.createCallout(
            `[${comment.section}] ${comment.content}${comment.resolved ? ' (Resolved)' : ''}`,
            comment.resolved ? '✅' : '💬'
          )
        );
      });
    }

    return blocks;
  }

  // Helper methods for creating Notion blocks

  private richText(
    content: string,
    annotations?: { bold?: boolean; italic?: boolean; code?: boolean; color?: string }
  ): RichTextItemRequest {
    return {
      type: 'text',
      text: { content },
      annotations: {
        bold: annotations?.bold || false,
        italic: annotations?.italic || false,
        strikethrough: false,
        underline: false,
        code: annotations?.code || false,
        color: (annotations?.color as 'default') || 'default',
      },
    };
  }

  private createHeading1(text: string): BlockObjectRequest {
    return {
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [this.richText(text)],
      },
    };
  }

  private createHeading2(text: string): BlockObjectRequest {
    return {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [this.richText(text)],
      },
    };
  }

  private createParagraph(content: string | RichTextItemRequest[]): BlockObjectRequest {
    const richText = typeof content === 'string' ? [this.richText(content)] : content;
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: richText,
      },
    };
  }

  private createBulletedListItem(richText: RichTextItemRequest[]): BlockObjectRequest {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: richText,
      },
    };
  }

  private createNumberedListItem(richText: RichTextItemRequest[]): BlockObjectRequest {
    return {
      object: 'block',
      type: 'numbered_list_item',
      numbered_list_item: {
        rich_text: richText,
      },
    };
  }

  private createToDo(text: string, checked: boolean): BlockObjectRequest {
    return {
      object: 'block',
      type: 'to_do',
      to_do: {
        rich_text: [this.richText(text)],
        checked,
      },
    };
  }

  private createCallout(text: string, emoji: string): BlockObjectRequest {
    return {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [this.richText(text)],
        icon: { type: 'emoji', emoji: emoji as '📌' },
      },
    };
  }

  private createQuote(richText: RichTextItemRequest[]): BlockObjectRequest {
    return {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: richText,
      },
    };
  }

  private createDivider(): BlockObjectRequest {
    return {
      object: 'block',
      type: 'divider',
      divider: {},
    };
  }

  private createTableOfContents(): BlockObjectRequest {
    return {
      object: 'block',
      type: 'table_of_contents',
      table_of_contents: {},
    };
  }

  private createTable(metrics: SuccessMetric[]): BlockObjectRequest {
    // Create a simple table for success metrics
    // Use a more flexible type that matches Notion's table structure
    type TableRowBlock = {
      object: 'block';
      type: 'table_row';
      table_row: {
        cells: RichTextItemRequest[][];
      };
    };

    const tableRows: TableRowBlock[] = [];

    // Header row
    tableRows.push({
      object: 'block',
      type: 'table_row',
      table_row: {
        cells: [
          [this.richText('Metric', { bold: true })],
          [this.richText('Baseline', { bold: true })],
          [this.richText('Target', { bold: true })],
        ],
      },
    });

    // Data rows
    metrics.forEach((metric) => {
      tableRows.push({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [this.richText(metric.metric)],
            [this.richText(metric.baseline || 'N/A')],
            [this.richText(metric.target)],
          ],
        },
      });
    });

    // Cast to satisfy the Notion API's table children requirement
    return {
      object: 'block',
      type: 'table',
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
        children: tableRows as unknown as BlockObjectRequest[],
      },
    } as BlockObjectRequest;
  }

  private formatRequirement(req: PRDRequirement): string {
    let text = req.description;
    if (req.priority) text += ` (${req.priority.toUpperCase()})`;
    if (req.category) text += ` [${req.category}]`;
    return text;
  }

  private getStatusEmoji(status: string): string {
    const statusEmojis: Record<string, string> = {
      DRAFT: '📝',
      REVIEW: '👀',
      APPROVED: '✅',
      IN_DEVELOPMENT: '🚧',
      SHIPPED: '🚀',
      ARCHIVED: '📦',
    };
    return statusEmojis[status] || '📄';
  }
}

export const notionExporter = new NotionExporter();
