/**
 * PDF Exporter Service
 * Generates PDF documents from PRD content using pdfkit
 */

import PDFDocument from 'pdfkit';
import { logger } from '@skillancer/logger';
import type { PRDWithRelations } from '@skillancer/types';

const log = logger.child({ service: 'pdf-exporter' });

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

// PDF styling configuration
const PDF_CONFIG = {
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  fonts: {
    title: { size: 24, font: 'Helvetica-Bold' },
    heading1: { size: 18, font: 'Helvetica-Bold' },
    heading2: { size: 14, font: 'Helvetica-Bold' },
    body: { size: 11, font: 'Helvetica' },
    caption: { size: 9, font: 'Helvetica-Oblique' },
  },
  colors: {
    primary: '#1a365d',
    secondary: '#2d3748',
    accent: '#3182ce',
    muted: '#718096',
    border: '#e2e8f0',
  },
  spacing: {
    section: 25,
    paragraph: 12,
    line: 6,
  },
};

export class PDFExporter {
  /**
   * Export PRD to PDF format
   */
  async export(prd: PRDWithRelations): Promise<Buffer> {
    log.info({ prdId: prd.id }, 'Starting PDF export');

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: PDF_CONFIG.margins,
          info: {
            Title: prd.title,
            Author: 'Skillancer PRD Builder',
            Subject: 'Product Requirements Document',
            Keywords: 'PRD, requirements, product',
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const result = Buffer.concat(chunks);
          log.info({ prdId: prd.id, size: result.length }, 'PDF export completed');
          resolve(result);
        });
        doc.on('error', reject);

        // Build the PDF content
        this.buildPDF(doc, prd);

        doc.end();
      } catch (error) {
        log.error({ prdId: prd.id, error }, 'PDF export failed');
        reject(error);
      }
    });
  }

  private buildPDF(doc: PDFKit.PDFDocument, prd: PRDWithRelations): void {
    // Cast JSON fields to proper types
    const goals = (prd.goals || []) as unknown as PRDGoal[];
    const userStories = (prd.userStories || []) as unknown as UserStory[];
    const requirements = (prd.requirements || []) as unknown as PRDRequirement[];
    const successMetrics = (prd.successMetrics || []) as unknown as SuccessMetric[];
    const timeline = prd.timeline as unknown as PRDTimeline | null;

    // Title page
    this.addTitlePage(doc, prd);

    // Table of Contents
    doc.addPage();
    this.addTableOfContents(doc, prd);

    // Content sections
    doc.addPage();

    // Overview section
    if (prd.overview) {
      this.addSection(doc, 'Overview', prd.overview);
    }

    // Problem Statement
    if (prd.problemStatement) {
      this.addSection(doc, 'Problem Statement', prd.problemStatement);
    }

    // Goals
    if (goals.length > 0) {
      this.addGoalsSection(doc, goals);
    }

    // User Stories
    if (userStories.length > 0) {
      this.addUserStoriesSection(doc, userStories);
    }

    // Requirements
    if (requirements.length > 0) {
      this.addRequirementsSection(doc, requirements);
    }

    // Success Metrics
    if (successMetrics.length > 0) {
      this.addSuccessMetricsSection(doc, successMetrics);
    }

    // Timeline
    if (timeline?.phases && timeline.phases.length > 0) {
      this.addTimelineSection(doc, timeline);
    }

    // Open Questions
    if (prd.openQuestions && prd.openQuestions.length > 0) {
      this.addOpenQuestionsSection(doc, prd.openQuestions);
    }

    // Appendix
    if (prd.appendix) {
      this.addSection(doc, 'Appendix', prd.appendix);
    }

    // Footer with page numbers
    this.addPageNumbers(doc);
  }

  private addTitlePage(doc: PDFKit.PDFDocument, prd: PRDWithRelations): void {
    const pageWidth = doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right;

    // Add some vertical spacing
    doc.moveDown(6);

    // Title
    doc
      .font(PDF_CONFIG.fonts.title.font)
      .fontSize(PDF_CONFIG.fonts.title.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text(prd.title, { align: 'center', width: pageWidth });

    doc.moveDown(2);

    // Status badge
    doc
      .font(PDF_CONFIG.fonts.heading2.font)
      .fontSize(PDF_CONFIG.fonts.heading2.size)
      .fillColor(this.getStatusColor(prd.status))
      .text(`Status: ${prd.status}`, { align: 'center', width: pageWidth });

    doc.moveDown(4);

    // Metadata
    doc
      .font(PDF_CONFIG.fonts.body.font)
      .fontSize(PDF_CONFIG.fonts.body.size)
      .fillColor(PDF_CONFIG.colors.secondary);

    if (prd.engagement) {
      doc.text(`Engagement: ${prd.engagement.title}`, { align: 'center', width: pageWidth });
      doc.moveDown(0.5);
    }

    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`, { align: 'center', width: pageWidth });

    // Decorative line
    doc.moveDown(4);
    const lineY = doc.y;
    doc
      .strokeColor(PDF_CONFIG.colors.border)
      .lineWidth(2)
      .moveTo(PDF_CONFIG.margins.left + 100, lineY)
      .lineTo(doc.page.width - PDF_CONFIG.margins.right - 100, lineY)
      .stroke();
  }

  private addTableOfContents(doc: PDFKit.PDFDocument, prd: PRDWithRelations): void {
    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Table of Contents');

    doc.moveDown(1.5);

    const tocItems: string[] = [];
    if (prd.overview) tocItems.push('Overview');
    if (prd.problemStatement) tocItems.push('Problem Statement');
    if ((prd.goals as unknown as PRDGoal[])?.length > 0) tocItems.push('Goals');
    if ((prd.userStories as unknown as UserStory[])?.length > 0) tocItems.push('User Stories');
    if ((prd.requirements as unknown as PRDRequirement[])?.length > 0) tocItems.push('Requirements');
    if ((prd.successMetrics as unknown as SuccessMetric[])?.length > 0) tocItems.push('Success Metrics');
    if ((prd.timeline as unknown as PRDTimeline)?.phases?.length > 0) tocItems.push('Timeline');
    if (prd.openQuestions?.length > 0) tocItems.push('Open Questions');
    if (prd.appendix) tocItems.push('Appendix');

    doc
      .font(PDF_CONFIG.fonts.body.font)
      .fontSize(PDF_CONFIG.fonts.body.size)
      .fillColor(PDF_CONFIG.colors.secondary);

    tocItems.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`);
      doc.moveDown(0.5);
    });
  }

  private addSection(doc: PDFKit.PDFDocument, title: string, content: string): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text(title);

    doc.moveDown(0.5);

    // Add underline
    const lineY = doc.y;
    doc
      .strokeColor(PDF_CONFIG.colors.accent)
      .lineWidth(1)
      .moveTo(PDF_CONFIG.margins.left, lineY)
      .lineTo(PDF_CONFIG.margins.left + 100, lineY)
      .stroke();

    doc.moveDown(1);

    doc
      .font(PDF_CONFIG.fonts.body.font)
      .fontSize(PDF_CONFIG.fonts.body.size)
      .fillColor(PDF_CONFIG.colors.secondary)
      .text(content, {
        align: 'justify',
        lineGap: PDF_CONFIG.spacing.line,
      });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addGoalsSection(doc: PDFKit.PDFDocument, goals: PRDGoal[]): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Goals');

    doc.moveDown(1);

    goals.forEach((goal, index) => {
      this.checkPageBreak(doc, 60);

      doc
        .font(PDF_CONFIG.fonts.heading2.font)
        .fontSize(PDF_CONFIG.fonts.heading2.size)
        .fillColor(PDF_CONFIG.colors.secondary)
        .text(`${index + 1}. ${goal.goal}`);

      doc.moveDown(0.3);

      doc
        .font(PDF_CONFIG.fonts.body.font)
        .fontSize(PDF_CONFIG.fonts.body.size)
        .fillColor(PDF_CONFIG.colors.muted);

      if (goal.metric) {
        doc.text(`Metric: ${goal.metric}`, { indent: 20 });
      }
      if (goal.target) {
        doc.text(`Target: ${goal.target}`, { indent: 20 });
      }
      if (goal.priority) {
        doc.text(`Priority: ${goal.priority.toUpperCase()}`, { indent: 20 });
      }

      doc.moveDown(0.8);
    });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addUserStoriesSection(doc: PDFKit.PDFDocument, userStories: UserStory[]): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('User Stories');

    doc.moveDown(1);

    userStories.forEach((story, index) => {
      this.checkPageBreak(doc, 100);

      doc
        .font(PDF_CONFIG.fonts.heading2.font)
        .fontSize(PDF_CONFIG.fonts.heading2.size)
        .fillColor(PDF_CONFIG.colors.secondary)
        .text(`Story ${index + 1}`);

      doc.moveDown(0.5);

      // User story format
      doc
        .font(PDF_CONFIG.fonts.body.font)
        .fontSize(PDF_CONFIG.fonts.body.size)
        .fillColor(PDF_CONFIG.colors.secondary);

      doc.text(`As a ${story.as},`, { continued: false });
      doc.text(`I want to ${story.iWant},`, { continued: false });
      doc.text(`so that ${story.soThat}.`, { continued: false });

      // Acceptance Criteria
      if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
        doc.moveDown(0.5);
        doc
          .font(PDF_CONFIG.fonts.caption.font)
          .fillColor(PDF_CONFIG.colors.muted)
          .text('Acceptance Criteria:');

        story.acceptanceCriteria.forEach((criterion) => {
          doc.text(`  - ${criterion}`);
        });
      }

      if (story.priority) {
        doc.moveDown(0.3);
        doc
          .font(PDF_CONFIG.fonts.caption.font)
          .fillColor(PDF_CONFIG.colors.muted)
          .text(`Priority: ${story.priority}`);
      }

      doc.moveDown(1);
    });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addRequirementsSection(doc: PDFKit.PDFDocument, requirements: PRDRequirement[]): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Requirements');

    doc.moveDown(1);

    // Group by type
    const functional = requirements.filter((r) => r.type === 'functional');
    const nonFunctional = requirements.filter((r) => r.type === 'non-functional');

    if (functional.length > 0) {
      doc
        .font(PDF_CONFIG.fonts.heading2.font)
        .fontSize(PDF_CONFIG.fonts.heading2.size)
        .fillColor(PDF_CONFIG.colors.secondary)
        .text('Functional Requirements');

      doc.moveDown(0.5);

      this.addRequirementsList(doc, functional);
      doc.moveDown(1);
    }

    if (nonFunctional.length > 0) {
      doc
        .font(PDF_CONFIG.fonts.heading2.font)
        .fontSize(PDF_CONFIG.fonts.heading2.size)
        .fillColor(PDF_CONFIG.colors.secondary)
        .text('Non-Functional Requirements');

      doc.moveDown(0.5);

      this.addRequirementsList(doc, nonFunctional);
    }

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addRequirementsList(doc: PDFKit.PDFDocument, requirements: PRDRequirement[]): void {
    requirements.forEach((req) => {
      this.checkPageBreak(doc, 40);

      doc
        .font(PDF_CONFIG.fonts.body.font)
        .fontSize(PDF_CONFIG.fonts.body.size)
        .fillColor(PDF_CONFIG.colors.secondary);

      let text = `- ${req.description}`;
      if (req.priority) {
        text += ` (${req.priority.toUpperCase()})`;
      }
      if (req.category) {
        text += ` [${req.category}]`;
      }

      doc.text(text, { indent: 10 });
      doc.moveDown(0.3);
    });
  }

  private addSuccessMetricsSection(doc: PDFKit.PDFDocument, metrics: SuccessMetric[]): void {
    this.checkPageBreak(doc, 150);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Success Metrics');

    doc.moveDown(1);

    // Create a simple table
    const tableTop = doc.y;
    const colWidths = [200, 100, 100];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header row
    doc
      .font(PDF_CONFIG.fonts.heading2.font)
      .fontSize(10)
      .fillColor(PDF_CONFIG.colors.primary);

    let xPos = PDF_CONFIG.margins.left;
    doc.text('Metric', xPos, tableTop, { width: colWidths[0] });
    xPos += colWidths[0];
    doc.text('Baseline', xPos, tableTop, { width: colWidths[1] });
    xPos += colWidths[1];
    doc.text('Target', xPos, tableTop, { width: colWidths[2] });

    // Header line
    doc.moveDown(0.5);
    const headerLineY = doc.y;
    doc
      .strokeColor(PDF_CONFIG.colors.border)
      .lineWidth(1)
      .moveTo(PDF_CONFIG.margins.left, headerLineY)
      .lineTo(PDF_CONFIG.margins.left + tableWidth, headerLineY)
      .stroke();

    doc.moveDown(0.5);

    // Data rows
    doc
      .font(PDF_CONFIG.fonts.body.font)
      .fontSize(PDF_CONFIG.fonts.body.size)
      .fillColor(PDF_CONFIG.colors.secondary);

    metrics.forEach((metric) => {
      this.checkPageBreak(doc, 30);

      const rowY = doc.y;
      xPos = PDF_CONFIG.margins.left;

      doc.text(metric.metric, xPos, rowY, { width: colWidths[0] });
      xPos += colWidths[0];
      doc.text(metric.baseline || 'N/A', xPos, rowY, { width: colWidths[1] });
      xPos += colWidths[1];
      doc.text(metric.target, xPos, rowY, { width: colWidths[2] });

      doc.moveDown(0.8);
    });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addTimelineSection(doc: PDFKit.PDFDocument, timeline: PRDTimeline): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Timeline');

    doc.moveDown(1);

    timeline.phases.forEach((phase, index) => {
      this.checkPageBreak(doc, 80);

      doc
        .font(PDF_CONFIG.fonts.heading2.font)
        .fontSize(PDF_CONFIG.fonts.heading2.size)
        .fillColor(PDF_CONFIG.colors.secondary)
        .text(`Phase ${index + 1}: ${phase.name}`);

      doc.moveDown(0.3);

      doc
        .font(PDF_CONFIG.fonts.body.font)
        .fontSize(PDF_CONFIG.fonts.body.size)
        .fillColor(PDF_CONFIG.colors.muted);

      if (phase.startDate || phase.endDate) {
        const dateRange = [phase.startDate, phase.endDate].filter(Boolean).join(' - ');
        doc.text(`Duration: ${dateRange}`, { indent: 10 });
      }

      if (phase.milestones && phase.milestones.length > 0) {
        doc.moveDown(0.3);
        doc.text('Milestones:', { indent: 10 });

        phase.milestones.forEach((milestone) => {
          let text = `  - ${milestone.name}`;
          if (milestone.date) text += ` (${milestone.date})`;
          if (milestone.status) text += ` [${milestone.status}]`;
          doc.text(text, { indent: 10 });
        });
      }

      doc.moveDown(1);
    });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addOpenQuestionsSection(doc: PDFKit.PDFDocument, questions: string[]): void {
    this.checkPageBreak(doc, 100);

    doc
      .font(PDF_CONFIG.fonts.heading1.font)
      .fontSize(PDF_CONFIG.fonts.heading1.size)
      .fillColor(PDF_CONFIG.colors.primary)
      .text('Open Questions');

    doc.moveDown(1);

    doc
      .font(PDF_CONFIG.fonts.body.font)
      .fontSize(PDF_CONFIG.fonts.body.size)
      .fillColor(PDF_CONFIG.colors.secondary);

    questions.forEach((question, index) => {
      this.checkPageBreak(doc, 30);
      doc.text(`${index + 1}. ${question}`);
      doc.moveDown(0.5);
    });

    doc.moveDown(PDF_CONFIG.spacing.section / 10);
  }

  private addPageNumbers(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);

      // Skip title page
      if (i === 0) continue;

      doc
        .font(PDF_CONFIG.fonts.caption.font)
        .fontSize(9)
        .fillColor(PDF_CONFIG.colors.muted)
        .text(
          `Page ${i} of ${pages.count}`,
          PDF_CONFIG.margins.left,
          doc.page.height - PDF_CONFIG.margins.bottom + 20,
          { align: 'center', width: doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right }
        );
    }
  }

  private checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number): void {
    const remainingSpace = doc.page.height - PDF_CONFIG.margins.bottom - doc.y;
    if (remainingSpace < requiredSpace) {
      doc.addPage();
    }
  }

  private getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      DRAFT: '#718096',
      REVIEW: '#d69e2e',
      APPROVED: '#38a169',
      IN_DEVELOPMENT: '#3182ce',
      SHIPPED: '#805ad5',
      ARCHIVED: '#a0aec0',
    };
    return statusColors[status] || PDF_CONFIG.colors.secondary;
  }
}

export const pdfExporter = new PDFExporter();
