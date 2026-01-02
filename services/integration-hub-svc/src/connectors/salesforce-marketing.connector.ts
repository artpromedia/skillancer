// @ts-nocheck
import { BaseConnector, ConnectorConfig, OAuthCredentials } from './base.connector';

interface SalesforceLead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  source: string;
  createdDate: string;
  convertedDate?: string;
}

interface SalesforceOpportunity {
  id: string;
  name: string;
  amount: number;
  stageName: string;
  probability: number;
  closeDate: string;
  leadSource: string;
  campaignId?: string;
  isWon: boolean;
  isClosed: boolean;
}

interface SalesforceCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate?: string;
  endDate?: string;
  budgetedCost: number;
  actualCost: number;
  expectedRevenue: number;
  numberOfLeads: number;
  numberOfOpportunities: number;
  amountWonOpportunities: number;
}

interface LeadFilters {
  status?: string;
  source?: string;
  dateRange?: { startDate: string; endDate: string };
}

interface OpportunityFilters {
  stageName?: string;
  leadSource?: string;
  dateRange?: { startDate: string; endDate: string };
  campaignId?: string;
}

export class SalesforceMarketingConnector extends BaseConnector {
  readonly providerId = 'salesforce-marketing';
  readonly displayName = 'Salesforce (Marketing View)';
  readonly description = 'CRM platform - read-only marketing data';
  readonly icon = 'salesforce';

  readonly oauthConfig = {
    authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token'],
  };

  readonly supportedWidgets = ['pipeline-from-marketing', 'lead-status', 'campaign-roi'];

  private instanceUrl: string = '';

  constructor(config: ConnectorConfig) {
    super(config);
    if (config.metadata?.instanceUrl) {
      this.instanceUrl = config.metadata.instanceUrl;
    }
  }

  async testConnection(credentials: OAuthCredentials): Promise<boolean> {
    try {
      await this.query(credentials, 'SELECT Id FROM Lead LIMIT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async query(credentials: OAuthCredentials, soql: string): Promise<any> {
    const url = `${this.instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`;
    return this.makeRequest(url, { method: 'GET' }, credentials);
  }

  async getLeads(
    credentials: OAuthCredentials,
    filters?: LeadFilters,
    limit = 100
  ): Promise<SalesforceLead[]> {
    let soql = `
      SELECT Id, Name, Email, Company, Status, LeadSource, CreatedDate, ConvertedDate
      FROM Lead
    `;

    const conditions: string[] = [];

    if (filters?.status) {
      conditions.push(`Status = '${filters.status}'`);
    }
    if (filters?.source) {
      conditions.push(`LeadSource = '${filters.source}'`);
    }
    if (filters?.dateRange) {
      conditions.push(`CreatedDate >= ${filters.dateRange.startDate}T00:00:00Z`);
      conditions.push(`CreatedDate <= ${filters.dateRange.endDate}T23:59:59Z`);
    }

    if (conditions.length > 0) {
      soql += ` WHERE ${conditions.join(' AND ')}`;
    }

    soql += ` ORDER BY CreatedDate DESC LIMIT ${limit}`;

    const response = await this.query(credentials, soql);

    return (response.records || []).map((lead: any) => ({
      id: lead.Id,
      name: lead.Name,
      email: lead.Email,
      company: lead.Company,
      status: lead.Status,
      source: lead.LeadSource,
      createdDate: lead.CreatedDate,
      convertedDate: lead.ConvertedDate,
    }));
  }

  async getLeadsByStatus(credentials: OAuthCredentials): Promise<Record<string, number>> {
    const soql = `
      SELECT Status, COUNT(Id) cnt
      FROM Lead
      GROUP BY Status
    `;

    const response = await this.query(credentials, soql);

    const result: Record<string, number> = {};
    for (const record of response.records || []) {
      result[record.Status] = record.cnt;
    }
    return result;
  }

  async getOpportunities(
    credentials: OAuthCredentials,
    filters?: OpportunityFilters,
    limit = 100
  ): Promise<SalesforceOpportunity[]> {
    let soql = `
      SELECT Id, Name, Amount, StageName, Probability, CloseDate, LeadSource, 
             CampaignId, IsWon, IsClosed
      FROM Opportunity
    `;

    const conditions: string[] = [];

    if (filters?.stageName) {
      conditions.push(`StageName = '${filters.stageName}'`);
    }
    if (filters?.leadSource) {
      conditions.push(`LeadSource = '${filters.leadSource}'`);
    }
    if (filters?.campaignId) {
      conditions.push(`CampaignId = '${filters.campaignId}'`);
    }
    if (filters?.dateRange) {
      conditions.push(`CreatedDate >= ${filters.dateRange.startDate}T00:00:00Z`);
      conditions.push(`CreatedDate <= ${filters.dateRange.endDate}T23:59:59Z`);
    }

    if (conditions.length > 0) {
      soql += ` WHERE ${conditions.join(' AND ')}`;
    }

    soql += ` ORDER BY CloseDate DESC LIMIT ${limit}`;

    const response = await this.query(credentials, soql);

    return (response.records || []).map((opp: any) => ({
      id: opp.Id,
      name: opp.Name,
      amount: opp.Amount || 0,
      stageName: opp.StageName,
      probability: opp.Probability || 0,
      closeDate: opp.CloseDate,
      leadSource: opp.LeadSource,
      campaignId: opp.CampaignId,
      isWon: opp.IsWon,
      isClosed: opp.IsClosed,
    }));
  }

  async getCampaigns(credentials: OAuthCredentials): Promise<SalesforceCampaign[]> {
    const soql = `
      SELECT Id, Name, Type, Status, StartDate, EndDate, 
             BudgetedCost, ActualCost, ExpectedRevenue,
             NumberOfLeads, NumberOfOpportunities, AmountWonOpportunities
      FROM Campaign
      WHERE IsActive = true
      ORDER BY StartDate DESC
      LIMIT 50
    `;

    const response = await this.query(credentials, soql);

    return (response.records || []).map((campaign: any) => ({
      id: campaign.Id,
      name: campaign.Name,
      type: campaign.Type,
      status: campaign.Status,
      startDate: campaign.StartDate,
      endDate: campaign.EndDate,
      budgetedCost: campaign.BudgetedCost || 0,
      actualCost: campaign.ActualCost || 0,
      expectedRevenue: campaign.ExpectedRevenue || 0,
      numberOfLeads: campaign.NumberOfLeads || 0,
      numberOfOpportunities: campaign.NumberOfOpportunities || 0,
      amountWonOpportunities: campaign.AmountWonOpportunities || 0,
    }));
  }

  async getCampaignMembers(
    credentials: OAuthCredentials,
    campaignId: string
  ): Promise<{ leads: number; contacts: number; responded: number }> {
    const soql = `
      SELECT COUNT(Id) cnt, LeadOrContactId, HasResponded
      FROM CampaignMember
      WHERE CampaignId = '${campaignId}'
      GROUP BY LeadOrContactId, HasResponded
    `;

    const response = await this.query(credentials, soql);

    let leads = 0;
    let contacts = 0;
    let responded = 0;

    for (const record of response.records || []) {
      if (record.LeadOrContactId?.startsWith('00Q')) {
        leads += record.cnt;
      } else {
        contacts += record.cnt;
      }
      if (record.HasResponded) {
        responded += record.cnt;
      }
    }

    return { leads, contacts, responded };
  }

  async getMarketingPipeline(
    credentials: OAuthCredentials,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<any> {
    // Marketing-sourced = has LeadSource or Campaign association
    let soql = `
      SELECT StageName, SUM(Amount) totalAmount, COUNT(Id) cnt
      FROM Opportunity
      WHERE (LeadSource != null OR CampaignId != null)
        AND IsClosed = false
    `;

    if (dateRange) {
      soql += ` AND CreatedDate >= ${dateRange.startDate}T00:00:00Z`;
      soql += ` AND CreatedDate <= ${dateRange.endDate}T23:59:59Z`;
    }

    soql += ` GROUP BY StageName`;

    const response = await this.query(credentials, soql);

    const byStage: Record<string, { amount: number; count: number }> = {};
    let totalPipeline = 0;
    let totalOpps = 0;

    for (const record of response.records || []) {
      byStage[record.StageName] = {
        amount: record.totalAmount || 0,
        count: record.cnt,
      };
      totalPipeline += record.totalAmount || 0;
      totalOpps += record.cnt;
    }

    return {
      totalPipeline,
      totalOpportunities: totalOpps,
      byStage,
    };
  }

  async getWidgetData(
    widgetType: string,
    credentials: OAuthCredentials,
    options?: { dateRange?: { startDate: string; endDate: string } }
  ): Promise<any> {
    switch (widgetType) {
      case 'pipeline-from-marketing':
        return this.getPipelineFromMarketingData(credentials, options?.dateRange);

      case 'lead-status':
        return this.getLeadStatusData(credentials);

      case 'campaign-roi':
        return this.getCampaignROIData(credentials);

      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getPipelineFromMarketingData(
    credentials: OAuthCredentials,
    dateRange?: { startDate: string; endDate: string }
  ) {
    const [pipeline, opportunities] = await Promise.all([
      this.getMarketingPipeline(credentials, dateRange),
      this.getOpportunities(credentials, { dateRange }, 50),
    ]);

    // Group by source
    const bySource: Record<string, number> = {};
    for (const opp of opportunities) {
      const source = opp.leadSource || 'Unknown';
      bySource[source] = (bySource[source] || 0) + opp.amount;
    }

    return {
      ...pipeline,
      bySource,
      topOpportunities: opportunities.slice(0, 5).map((o) => ({
        name: o.name,
        amount: o.amount,
        stage: o.stageName,
        source: o.leadSource,
      })),
    };
  }

  private async getLeadStatusData(credentials: OAuthCredentials) {
    const [byStatus, recentLeads] = await Promise.all([
      this.getLeadsByStatus(credentials),
      this.getLeads(credentials, undefined, 20),
    ]);

    const totalLeads = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const convertedCount = recentLeads.filter((l) => l.convertedDate).length;

    return {
      totalLeads,
      byStatus,
      conversionRate: totalLeads > 0 ? (convertedCount / recentLeads.length) * 100 : 0,
      recentLeads: recentLeads.slice(0, 5),
    };
  }

  private async getCampaignROIData(credentials: OAuthCredentials) {
    const campaigns = await this.getCampaigns(credentials);

    const withROI = campaigns.map((campaign) => ({
      ...campaign,
      roi:
        campaign.actualCost > 0
          ? ((campaign.amountWonOpportunities - campaign.actualCost) / campaign.actualCost) * 100
          : 0,
      costPerLead: campaign.numberOfLeads > 0 ? campaign.actualCost / campaign.numberOfLeads : 0,
      costPerOpportunity:
        campaign.numberOfOpportunities > 0
          ? campaign.actualCost / campaign.numberOfOpportunities
          : 0,
    }));

    const totals = withROI.reduce(
      (acc, c) => ({
        spend: acc.spend + c.actualCost,
        revenue: acc.revenue + c.amountWonOpportunities,
        leads: acc.leads + c.numberOfLeads,
        opportunities: acc.opportunities + c.numberOfOpportunities,
      }),
      { spend: 0, revenue: 0, leads: 0, opportunities: 0 }
    );

    return {
      campaigns: withROI.slice(0, 10),
      totals: {
        ...totals,
        overallROI: totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0,
      },
    };
  }
}

export const salesforceMarketingConnector = new SalesforceMarketingConnector({});

