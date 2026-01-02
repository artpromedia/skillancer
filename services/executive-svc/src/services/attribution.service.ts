// Attribution Service for CMO Suite
// Multi-touch attribution modeling for marketing analytics

export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'custom';

export interface Touchpoint {
  id: string;
  customerId: string;
  channel: string;
  campaign?: string;
  source?: string;
  medium?: string;
  timestamp: Date;
  isConversion: boolean;
  value?: number;
}

export interface AttributionResult {
  channel: string;
  campaign?: string;
  credit: number;
  percentage: number;
  conversions: number;
  revenue: number;
}

export interface CustomerJourney {
  customerId: string;
  touchpoints: Touchpoint[];
  converted: boolean;
  conversionValue?: number;
  conversionDate?: Date;
}

export interface AttributionReport {
  model: AttributionModel;
  dateRange: { start: Date; end: Date };
  totalConversions: number;
  totalRevenue: number;
  byChannel: AttributionResult[];
  byCampaign: AttributionResult[];
}

class AttributionService {
  // Calculate attribution for a single customer journey
  calculateAttribution(
    journey: CustomerJourney,
    model: AttributionModel,
    customWeights?: Record<string, number>
  ): Map<string, number> {
    const touchpoints = journey.touchpoints.filter((t) => !t.isConversion);
    const credits = new Map<string, number>();

    if (touchpoints.length === 0 || !journey.converted) {
      return credits;
    }

    const conversionValue = journey.conversionValue || 1;

    switch (model) {
      case 'first_touch':
        return this.firstTouchAttribution(touchpoints, conversionValue);

      case 'last_touch':
        return this.lastTouchAttribution(touchpoints, conversionValue);

      case 'linear':
        return this.linearAttribution(touchpoints, conversionValue);

      case 'time_decay':
        return this.timeDecayAttribution(touchpoints, conversionValue, journey.conversionDate);

      case 'position_based':
        return this.positionBasedAttribution(touchpoints, conversionValue);

      case 'custom':
        return this.customAttribution(touchpoints, conversionValue, customWeights || {});

      default:
        return this.linearAttribution(touchpoints, conversionValue);
    }
  }

  // First touch: 100% credit to first interaction
  private firstTouchAttribution(touchpoints: Touchpoint[], value: number): Map<string, number> {
    const credits = new Map<string, number>();
    const sorted = [...touchpoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (sorted.length > 0) {
      const key = this.getTouchpointKey(sorted[0]);
      credits.set(key, value);
    }

    return credits;
  }

  // Last touch: 100% credit to last interaction
  private lastTouchAttribution(touchpoints: Touchpoint[], value: number): Map<string, number> {
    const credits = new Map<string, number>();
    const sorted = [...touchpoints].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (sorted.length > 0) {
      const key = this.getTouchpointKey(sorted[0]);
      credits.set(key, value);
    }

    return credits;
  }

  // Linear: Equal credit to all touchpoints
  private linearAttribution(touchpoints: Touchpoint[], value: number): Map<string, number> {
    const credits = new Map<string, number>();
    const creditPerTouch = value / touchpoints.length;

    for (const tp of touchpoints) {
      const key = this.getTouchpointKey(tp);
      credits.set(key, (credits.get(key) || 0) + creditPerTouch);
    }

    return credits;
  }

  // Time decay: More credit to recent touchpoints
  private timeDecayAttribution(
    touchpoints: Touchpoint[],
    value: number,
    conversionDate?: Date
  ): Map<string, number> {
    const credits = new Map<string, number>();
    const endTime = conversionDate?.getTime() || Date.now();
    const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    // Calculate decay weights
    const weights: number[] = touchpoints.map((tp) => {
      const timeDiff = endTime - tp.timestamp.getTime();
      return Math.pow(0.5, timeDiff / halfLife);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    touchpoints.forEach((tp, i) => {
      const key = this.getTouchpointKey(tp);
      const credit = (weights[i] / totalWeight) * value;
      credits.set(key, (credits.get(key) || 0) + credit);
    });

    return credits;
  }

  // Position-based (U-shaped): 40% first, 40% last, 20% middle
  private positionBasedAttribution(touchpoints: Touchpoint[], value: number): Map<string, number> {
    const credits = new Map<string, number>();
    const sorted = [...touchpoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (sorted.length === 1) {
      const key = this.getTouchpointKey(sorted[0]);
      credits.set(key, value);
      return credits;
    }

    if (sorted.length === 2) {
      const firstKey = this.getTouchpointKey(sorted[0]);
      const lastKey = this.getTouchpointKey(sorted[1]);
      credits.set(firstKey, value * 0.5);
      credits.set(lastKey, (credits.get(lastKey) || 0) + value * 0.5);
      return credits;
    }

    // First touch: 40%
    const firstKey = this.getTouchpointKey(sorted[0]);
    credits.set(firstKey, value * 0.4);

    // Last touch: 40%
    const lastKey = this.getTouchpointKey(sorted[sorted.length - 1]);
    credits.set(lastKey, (credits.get(lastKey) || 0) + value * 0.4);

    // Middle touches: 20% split equally
    const middleCredit = (value * 0.2) / (sorted.length - 2);
    for (let i = 1; i < sorted.length - 1; i++) {
      const key = this.getTouchpointKey(sorted[i]);
      credits.set(key, (credits.get(key) || 0) + middleCredit);
    }

    return credits;
  }

  // Custom weighted attribution
  private customAttribution(
    touchpoints: Touchpoint[],
    value: number,
    weights: Record<string, number>
  ): Map<string, number> {
    const credits = new Map<string, number>();

    // Calculate total weight for normalization
    let totalWeight = 0;
    for (const tp of touchpoints) {
      const channelWeight = weights[tp.channel] || 1;
      totalWeight += channelWeight;
    }

    for (const tp of touchpoints) {
      const key = this.getTouchpointKey(tp);
      const channelWeight = weights[tp.channel] || 1;
      const credit = (channelWeight / totalWeight) * value;
      credits.set(key, (credits.get(key) || 0) + credit);
    }

    return credits;
  }

  // Get channel attribution across all journeys
  getChannelAttribution(
    journeys: CustomerJourney[],
    model: AttributionModel,
    customWeights?: Record<string, number>
  ): AttributionResult[] {
    const channelCredits = new Map<string, { credit: number; conversions: number }>();

    for (const journey of journeys) {
      if (!journey.converted) continue;

      const credits = this.calculateAttribution(journey, model, customWeights);

      for (const [key, credit] of credits) {
        const channel = key.split('::')[0];
        const existing = channelCredits.get(channel) || { credit: 0, conversions: 0 };
        channelCredits.set(channel, {
          credit: existing.credit + credit,
          conversions: existing.conversions + credit / (journey.conversionValue || 1),
        });
      }
    }

    const totalCredit = Array.from(channelCredits.values()).reduce((sum, c) => sum + c.credit, 0);

    return Array.from(channelCredits.entries()).map(([channel, data]) => ({
      channel,
      credit: data.credit,
      percentage: totalCredit > 0 ? (data.credit / totalCredit) * 100 : 0,
      conversions: data.conversions,
      revenue: data.credit,
    }));
  }

  // Get campaign attribution
  getCampaignAttribution(
    journeys: CustomerJourney[],
    model: AttributionModel
  ): AttributionResult[] {
    const campaignCredits = new Map<string, { credit: number; conversions: number }>();

    for (const journey of journeys) {
      if (!journey.converted) continue;

      const credits = this.calculateAttribution(journey, model);

      for (const [key, credit] of credits) {
        const parts = key.split('::');
        const campaign = parts[1] || 'Direct';
        const existing = campaignCredits.get(campaign) || { credit: 0, conversions: 0 };
        campaignCredits.set(campaign, {
          credit: existing.credit + credit,
          conversions: existing.conversions + credit / (journey.conversionValue || 1),
        });
      }
    }

    const totalCredit = Array.from(campaignCredits.values()).reduce((sum, c) => sum + c.credit, 0);

    return Array.from(campaignCredits.entries()).map(([campaign, data]) => ({
      channel: campaign,
      campaign,
      credit: data.credit,
      percentage: totalCredit > 0 ? (data.credit / totalCredit) * 100 : 0,
      conversions: data.conversions,
      revenue: data.credit,
    }));
  }

  // Generate full attribution report
  generateReport(
    journeys: CustomerJourney[],
    model: AttributionModel,
    dateRange: { start: Date; end: Date }
  ): AttributionReport {
    const convertedJourneys = journeys.filter((j) => j.converted);
    const totalRevenue = convertedJourneys.reduce((sum, j) => sum + (j.conversionValue || 0), 0);

    return {
      model,
      dateRange,
      totalConversions: convertedJourneys.length,
      totalRevenue,
      byChannel: this.getChannelAttribution(journeys, model),
      byCampaign: this.getCampaignAttribution(journeys, model),
    };
  }

  // Compare multiple attribution models
  compareModels(
    journeys: CustomerJourney[],
    models: AttributionModel[] = [
      'first_touch',
      'last_touch',
      'linear',
      'time_decay',
      'position_based',
    ]
  ): Record<AttributionModel, AttributionResult[]> {
    const comparison: Record<string, AttributionResult[]> = {};

    for (const model of models) {
      comparison[model] = this.getChannelAttribution(journeys, model);
    }

    return comparison as Record<AttributionModel, AttributionResult[]>;
  }

  // Helper to create unique key for touchpoint
  private getTouchpointKey(touchpoint: Touchpoint): string {
    return `${touchpoint.channel}::${touchpoint.campaign || 'none'}`;
  }
}

export const attributionService = new AttributionService();
