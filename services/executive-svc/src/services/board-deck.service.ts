/**
 * @module @skillancer/executive-svc/services/board-deck
 * Board Deck Service for CFO Tool Suite
 *
 * Manages board deck generation:
 * - Templates for different deck types
 * - Slide generation with financial data
 * - Export to PDF/PPTX
 */

import type { Prisma, PrismaClient } from '@skillancer/database';

export interface SlideContent {
  order: number;
  type: SlideType;
  title: string;
  content: Record<string, unknown>;
}

export type SlideType =
  | 'title'
  | 'agenda'
  | 'financial-summary'
  | 'revenue-metrics'
  | 'expense-breakdown'
  | 'cash-runway'
  | 'kpi-dashboard'
  | 'key-highlights'
  | 'challenges'
  | 'asks'
  | 'appendix';

export interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  slides: SlideType[];
}

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'standard-board',
    name: 'Standard Board Deck',
    description: 'Comprehensive board update with financials and KPIs',
    slides: [
      'title',
      'agenda',
      'key-highlights',
      'financial-summary',
      'revenue-metrics',
      'expense-breakdown',
      'cash-runway',
      'kpi-dashboard',
      'challenges',
      'asks',
    ],
  },
  {
    id: 'investor-update',
    name: 'Investor Update',
    description: 'Condensed update for investor meetings',
    slides: ['title', 'key-highlights', 'financial-summary', 'cash-runway', 'asks'],
  },
  {
    id: 'monthly-review',
    name: 'Monthly Financial Review',
    description: 'Detailed monthly financial review',
    slides: [
      'title',
      'financial-summary',
      'revenue-metrics',
      'expense-breakdown',
      'cash-runway',
      'kpi-dashboard',
    ],
  },
];

export class BoardDeckService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get available templates
   */
  getTemplates(): DeckTemplate[] {
    return DECK_TEMPLATES;
  }

  /**
   * Create a new deck from template
   */
  async createFromTemplate(input: {
    engagementId: string;
    templateId: string;
    title: string;
    period: string;
    data?: Record<string, unknown>;
  }): Promise<unknown> {
    const template = DECK_TEMPLATES.find((t) => t.id === input.templateId);
    if (!template) {
      throw new Error(`Template not found: ${input.templateId}`);
    }

    const slides = template.slides.map((type, index) =>
      this.generateSlide(type, index + 1, input.data || {})
    );

    return this.prisma.boardDeck.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        period: input.period,
        templateId: input.templateId,
        slides: slides as unknown as Prisma.JsonValue[],
        status: 'DRAFT',
      },
    });
  }

  /**
   * Generate slide content based on type
   */
  private generateSlide(
    type: SlideType,
    order: number,
    data: Record<string, unknown>
  ): SlideContent {
    const slideGenerators: Record<SlideType, () => SlideContent> = {
      title: () => ({
        order,
        type: 'title',
        title: 'Board Meeting',
        content: {
          companyName: data.companyName || 'Company Name',
          period: data.period || 'Q4 2024',
          date: new Date().toLocaleDateString(),
        },
      }),
      agenda: () => ({
        order,
        type: 'agenda',
        title: 'Agenda',
        content: {
          items: [
            'Financial Summary',
            'Key Metrics & KPIs',
            'Runway & Cash Position',
            'Challenges & Risks',
            'Board Asks',
          ],
        },
      }),
      'key-highlights': () => ({
        order,
        type: 'key-highlights',
        title: 'Key Highlights',
        content: {
          highlights: data.highlights || [
            'Placeholder highlight 1',
            'Placeholder highlight 2',
            'Placeholder highlight 3',
          ],
        },
      }),
      'financial-summary': () => ({
        order,
        type: 'financial-summary',
        title: 'Financial Summary',
        content: {
          revenue: data.revenue || { current: 0, previous: 0, change: 0 },
          expenses: data.expenses || { current: 0, previous: 0, change: 0 },
          netIncome: data.netIncome || { current: 0, previous: 0, change: 0 },
          cash: data.cash || { current: 0, previous: 0, change: 0 },
        },
      }),
      'revenue-metrics': () => ({
        order,
        type: 'revenue-metrics',
        title: 'Revenue Metrics',
        content: {
          mrr: data.mrr || 0,
          arr: data.arr || 0,
          growth: data.revenueGrowth || 0,
          byProduct: data.revenueByProduct || [],
        },
      }),
      'expense-breakdown': () => ({
        order,
        type: 'expense-breakdown',
        title: 'Expense Breakdown',
        content: {
          categories: data.expenseCategories || [],
          total: data.totalExpenses || 0,
          budgetVariance: data.budgetVariance || 0,
        },
      }),
      'cash-runway': () => ({
        order,
        type: 'cash-runway',
        title: 'Cash & Runway',
        content: {
          currentCash: data.currentCash || 0,
          monthlyBurn: data.monthlyBurn || 0,
          runway: data.runway || 0,
          zeroCashDate: data.zeroCashDate || null,
        },
      }),
      'kpi-dashboard': () => ({
        order,
        type: 'kpi-dashboard',
        title: 'Key Performance Indicators',
        content: {
          kpis: data.kpis || [],
        },
      }),
      challenges: () => ({
        order,
        type: 'challenges',
        title: 'Challenges & Risks',
        content: {
          challenges: data.challenges || [],
          mitigations: data.mitigations || [],
        },
      }),
      asks: () => ({
        order,
        type: 'asks',
        title: 'Board Asks',
        content: {
          asks: data.asks || [],
        },
      }),
      appendix: () => ({
        order,
        type: 'appendix',
        title: 'Appendix',
        content: {
          items: data.appendixItems || [],
        },
      }),
    };

    return slideGenerators[type]();
  }

  /**
   * Update deck slides
   */
  async updateSlides(deckId: string, slides: SlideContent[]): Promise<unknown> {
    return this.prisma.boardDeck.update({
      where: { id: deckId },
      data: {
        slides: slides as unknown as Prisma.JsonValue[],
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Populate deck with actual data
   */
  async populateWithData(deckId: string, financialData: Record<string, unknown>): Promise<unknown> {
    const deck = await this.prisma.boardDeck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      throw new Error('Deck not found');
    }

    const existingSlides = deck.slides as unknown as SlideContent[];
    const updatedSlides = existingSlides.map((slide) => {
      const generator = this.generateSlide(slide.type, slide.order, financialData);
      return {
        ...slide,
        content: generator.content,
      };
    });

    return this.prisma.boardDeck.update({
      where: { id: deckId },
      data: {
        slides: updatedSlides as unknown as Prisma.JsonValue[],
        status: 'GENERATED',
      },
    });
  }

  /**
   * Generate share token for deck
   */
  async generateShareToken(deckId: string): Promise<string> {
    const token = crypto.randomUUID();

    await this.prisma.boardDeck.update({
      where: { id: deckId },
      data: { shareToken: token },
    });

    return token;
  }

  /**
   * Get deck by share token
   */
  async getByShareToken(token: string): Promise<unknown | null> {
    return this.prisma.boardDeck.findFirst({
      where: { shareToken: token },
    });
  }

  /**
   * Mark deck as sent
   */
  async markAsSent(deckId: string): Promise<unknown> {
    return this.prisma.boardDeck.update({
      where: { id: deckId },
      data: { status: 'SENT' },
    });
  }

  /**
   * Archive deck
   */
  async archive(deckId: string): Promise<unknown> {
    return this.prisma.boardDeck.update({
      where: { id: deckId },
      data: { status: 'ARCHIVED' },
    });
  }
}

export const createBoardDeckService = (prisma: PrismaClient) => new BoardDeckService(prisma);
