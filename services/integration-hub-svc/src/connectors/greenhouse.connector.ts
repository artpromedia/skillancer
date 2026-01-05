import { EventEmitter } from 'node:events';

// Greenhouse Connector
//
// Authentication: API Key (Harvest API)
//
// Supported Widgets:
// 1. recruiting-pipeline - Candidates by stage, pipeline health, conversion rates
// 2. open-roles - Open positions, days open, candidates per role
// 3. hiring-velocity - Time to fill, offers extended, offers accepted
// 4. source-effectiveness - Candidates by source, hires by source, source ROI

interface GreenhouseConfig {
  apiKey: string;
}

interface Job {
  id: number;
  name: string;
  status: 'open' | 'closed' | 'draft';
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string }>;
  openedAt: string;
  closedAt?: string;
  requisitionId?: string;
  hiringTeam: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
  customFields: Record<string, unknown>;
}

interface Candidate {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: string;
  lastActivity: string;
  photoUrl?: string;
  recruiter?: { id: number; name: string };
  coordinator?: { id: number; name: string };
  applications: Application[];
}

interface Application {
  id: number;
  candidateId: number;
  jobId: number;
  status: 'active' | 'rejected' | 'hired';
  currentStage: {
    id: number;
    name: string;
  };
  source: {
    id: number;
    publicName: string;
  };
  appliedAt: string;
  lastActivityAt: string;
  rejectedAt?: string;
  prospectiveOffice?: { id: number; name: string };
  prospectiveDepartment?: { id: number; name: string };
}

interface Offer {
  id: number;
  applicationId: number;
  candidateId: number;
  jobId: number;
  status: 'unresolved' | 'accepted' | 'rejected' | 'deprecated';
  sentAt?: string;
  resolvedAt?: string;
  startsAt?: string;
  customFields: Record<string, unknown>;
}

interface Stage {
  id: number;
  name: string;
  priority: number;
  jobId: number;
}

interface Source {
  id: number;
  name: string;
  type: {
    id: number;
    name: string;
  };
}

interface RecruitingPipeline {
  stages: Array<{
    name: string;
    count: number;
    percentageOfTotal: number;
  }>;
  conversionRates: Array<{
    fromStage: string;
    toStage: string;
    rate: number;
  }>;
  totalCandidates: number;
}

interface OpenRole {
  id: number;
  title: string;
  department: string;
  location: string;
  daysOpen: number;
  candidatesInPipeline: number;
  hiringManager: string;
  status: 'urgent' | 'on-track' | 'new';
}

interface HiringVelocity {
  averageTimeToFill: number;
  medianTimeToFill: number;
  offersExtended: number;
  offersAccepted: number;
  offerAcceptanceRate: number;
  hiresThisMonth: number;
  hiresThisQuarter: number;
}

interface SourceEffectiveness {
  sources: Array<{
    name: string;
    candidates: number;
    interviews: number;
    hires: number;
    conversionRate: number;
    costPerHire?: number;
  }>;
  topPerformingSources: string[];
}

export class GreenhouseConnector extends EventEmitter {
  private config: GreenhouseConfig;
  private baseUrl = 'https://harvest.greenhouse.io/v1';

  constructor(config: GreenhouseConfig) {
    super();
    this.config = config;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.config.apiKey}:`).toString('base64')}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Greenhouse API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async paginatedRequest<T>(endpoint: string): Promise<T[]> {
    let allResults: T[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const results = await this.request<T[]>(
        `${endpoint}${separator}per_page=${perPage}&page=${page}`
      );
      allResults = allResults.concat(results);
      hasMore = results.length === perPage;
      page++;
    }

    return allResults;
  }

  // ==================== JOB METHODS ====================

  async getJobs(status?: 'open' | 'closed' | 'draft'): Promise<Job[]> {
    let endpoint = '/jobs';
    if (status) endpoint += `?status=${status}`;
    return this.paginatedRequest<Job>(endpoint);
  }

  async getJob(jobId: number): Promise<Job> {
    return this.request<Job>(`/jobs/${jobId}`);
  }

  async getJobStages(jobId: number): Promise<Stage[]> {
    return this.request<Stage[]>(`/jobs/${jobId}/stages`);
  }

  // ==================== CANDIDATE METHODS ====================

  async getCandidates(jobId?: number): Promise<Candidate[]> {
    let endpoint = '/candidates';
    if (jobId) endpoint += `?job_id=${jobId}`;
    return this.paginatedRequest<Candidate>(endpoint);
  }

  async getCandidate(candidateId: number): Promise<Candidate> {
    return this.request<Candidate>(`/candidates/${candidateId}`);
  }

  // ==================== APPLICATION METHODS ====================

  async getApplications(jobId?: number, status?: string): Promise<Application[]> {
    let endpoint = '/applications';
    const params = new URLSearchParams();
    if (jobId) params.append('job_id', jobId.toString());
    if (status) params.append('status', status);
    if (params.toString()) endpoint += `?${params.toString()}`;

    return this.paginatedRequest<Application>(endpoint);
  }

  // ==================== OFFER METHODS ====================

  async getOffers(status?: string): Promise<Offer[]> {
    let endpoint = '/offers';
    if (status) endpoint += `?status=${status}`;
    return this.paginatedRequest<Offer>(endpoint);
  }

  // ==================== SOURCE METHODS ====================

  async getSources(): Promise<Source[]> {
    return this.request<Source[]>('/sources');
  }

  // ==================== WIDGET DATA METHODS ====================

  async getRecruitingPipeline(jobId?: number): Promise<RecruitingPipeline> {
    const applications = await this.getApplications(jobId, 'active');

    const stageCount: Record<string, number> = {};
    for (const app of applications) {
      const stageName = app.currentStage?.name || 'Unknown';
      stageCount[stageName] = (stageCount[stageName] || 0) + 1;
    }

    const totalCandidates = applications.length;
    const stages = Object.entries(stageCount).map(([name, count]) => ({
      name,
      count,
      percentageOfTotal: totalCandidates > 0 ? (count / totalCandidates) * 100 : 0,
    }));

    // Simplified conversion rates
    const conversionRates: RecruitingPipeline['conversionRates'] = [];
    const stageOrder = ['Application Review', 'Phone Screen', 'On-site', 'Offer'];
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const fromCount = stageCount[stageOrder[i]] || 0;
      const toCount = stageCount[stageOrder[i + 1]] || 0;
      if (fromCount > 0) {
        conversionRates.push({
          fromStage: stageOrder[i],
          toStage: stageOrder[i + 1],
          rate: (toCount / fromCount) * 100,
        });
      }
    }

    return { stages, conversionRates, totalCandidates };
  }

  async getOpenRoles(): Promise<OpenRole[]> {
    const jobs = await this.getJobs('open');
    const now = new Date();

    const openRoles: OpenRole[] = [];

    for (const job of jobs) {
      const applications = await this.getApplications(job.id, 'active');
      const openedAt = new Date(job.openedAt);
      const daysOpen = Math.floor((now.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24));

      const hiringManager = job.hiringTeam.find((t) => t.role === 'Hiring Manager');

      let status: OpenRole['status'] = 'on-track';
      if (daysOpen < 14) status = 'new';
      else if (daysOpen > 60 && applications.length < 10) status = 'urgent';

      openRoles.push({
        id: job.id,
        title: job.name,
        department: job.departments[0]?.name || 'Unknown',
        location: job.offices[0]?.name || 'Remote',
        daysOpen,
        candidatesInPipeline: applications.length,
        hiringManager: hiringManager?.name || 'Unassigned',
        status,
      });
    }

    return openRoles.sort((a, b) => {
      const statusOrder = { urgent: 0, 'on-track': 1, new: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  async getHiringVelocity(daysBack: number = 90): Promise<HiringVelocity> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const offers = await this.getOffers();
    const recentOffers = offers.filter((o) => {
      if (!o.sentAt) return false;
      return new Date(o.sentAt) >= cutoffDate;
    });

    const acceptedOffers = recentOffers.filter((o) => o.status === 'accepted');
    const rejectedOffers = recentOffers.filter((o) => o.status === 'rejected');

    // Calculate time to fill for accepted offers
    const timesToFill: number[] = [];
    for (const offer of acceptedOffers) {
      if (offer.resolvedAt && offer.sentAt) {
        const sent = new Date(offer.sentAt);
        const resolved = new Date(offer.resolvedAt);
        timesToFill.push(Math.floor((resolved.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    const averageTimeToFill =
      timesToFill.length > 0 ? timesToFill.reduce((a, b) => a + b, 0) / timesToFill.length : 0;

    const sortedTimes = [...timesToFill].sort((a, b) => a - b);
    const medianTimeToFill =
      sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;

    // Calculate monthly/quarterly hires
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const hiresThisMonth = acceptedOffers.filter((o) => {
      return o.resolvedAt && new Date(o.resolvedAt) >= monthStart;
    }).length;

    const hiresThisQuarter = acceptedOffers.filter((o) => {
      return o.resolvedAt && new Date(o.resolvedAt) >= quarterStart;
    }).length;

    return {
      averageTimeToFill,
      medianTimeToFill,
      offersExtended: recentOffers.length,
      offersAccepted: acceptedOffers.length,
      offerAcceptanceRate:
        recentOffers.length > 0
          ? (acceptedOffers.length / (acceptedOffers.length + rejectedOffers.length)) * 100
          : 0,
      hiresThisMonth,
      hiresThisQuarter,
    };
  }

  async getSourceEffectiveness(): Promise<SourceEffectiveness> {
    const applications = await this.getApplications();
    const offers = await this.getOffers('accepted');
    const sources = await this.getSources();

    const sourceStats: Record<string, { candidates: number; interviews: number; hires: number }> =
      {};

    // Initialize sources
    for (const source of sources) {
      sourceStats[source.name] = { candidates: 0, interviews: 0, hires: 0 };
    }

    // Count candidates by source
    for (const app of applications) {
      const sourceName = app.source?.publicName || 'Unknown';
      if (!sourceStats[sourceName]) {
        sourceStats[sourceName] = { candidates: 0, interviews: 0, hires: 0 };
      }
      sourceStats[sourceName].candidates++;

      // If past phone screen, count as interview
      if (['On-site', 'Offer', 'Hired'].includes(app.currentStage?.name)) {
        sourceStats[sourceName].interviews++;
      }
    }

    // Count hires by source
    for (const offer of offers) {
      const app = applications.find((a) => a.id === offer.applicationId);
      if (app) {
        const sourceName = app.source?.publicName || 'Unknown';
        if (sourceStats[sourceName]) {
          sourceStats[sourceName].hires++;
        }
      }
    }

    const sourcesArray = Object.entries(sourceStats)
      .map(([name, stats]) => ({
        name,
        ...stats,
        conversionRate: stats.candidates > 0 ? (stats.hires / stats.candidates) * 100 : 0,
      }))
      .sort((a, b) => b.hires - a.hires);

    const topPerformingSources = sourcesArray
      .filter((s) => s.hires > 0)
      .slice(0, 5)
      .map((s) => s.name);

    return { sources: sourcesArray, topPerformingSources };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getJobs();
      return true;
    } catch {
      return false;
    }
  }
}

export const createGreenhouseConnector = (config: GreenhouseConfig): GreenhouseConnector => {
  return new GreenhouseConnector(config);
};
