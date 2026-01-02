import { EventEmitter } from 'events';

// Pave Connector
//
// Authentication: API Key
//
// Supported Widgets:
// 1. compensation-benchmark - Pay vs market, by role/level, geographic adjustments
// 2. equity-overview - Equity distribution, burn rate, refresh grants needed

interface PaveConfig {
  apiKey: string;
  companyId?: string;
}

interface CompensationBenchmark {
  role: string;
  level: string;
  location: string;
  baseSalary: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  totalCompensation: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  equityValue: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface EquitySummary {
  totalPoolShares: number;
  totalPoolPercentage: number;
  issuedShares: number;
  issuedPercentage: number;
  availableShares: number;
  availablePercentage: number;
  burnRate: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  refreshGrantsNeeded: RefreshGrant[];
}

interface RefreshGrant {
  employeeId: string;
  employeeName: string;
  currentEquityValue: number;
  targetEquityValue: number;
  grantNeeded: number;
  vestingDate: string;
  priority: 'high' | 'medium' | 'low';
}

interface CompanyCompensation {
  totalEmployees: number;
  totalPayroll: number;
  totalEquityValue: number;
  avgBaseSalary: number;
  avgTotalCompensation: number;
  byDepartment: DepartmentCompensation[];
  byLevel: LevelCompensation[];
}

interface DepartmentCompensation {
  department: string;
  headcount: number;
  totalPayroll: number;
  avgBaseSalary: number;
  avgTotalComp: number;
}

interface LevelCompensation {
  level: string;
  headcount: number;
  avgBaseSalary: number;
  avgEquityValue: number;
  avgTotalComp: number;
}

interface CompensationComparison {
  role: string;
  level: string;
  employeeSalary: number;
  marketP50: number;
  percentileRank: number;
  variance: number;
  recommendation: 'above_market' | 'at_market' | 'below_market' | 'significantly_below';
}

export class PaveConnector extends EventEmitter {
  private config: PaveConfig;
  private baseUrl = 'https://api.pave.dev/v1';

  constructor(config: PaveConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pave API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== BENCHMARK METHODS ====================

  async getBenchmarks(roles: string[], location?: string): Promise<CompensationBenchmark[]> {
    const params = new URLSearchParams();
    roles.forEach((role) => params.append('roles[]', role));
    if (location) params.append('location', location);

    return this.request<CompensationBenchmark[]>(`/benchmarks?${params.toString()}`);
  }

  async getBenchmarkForRole(
    role: string,
    level: string,
    location?: string
  ): Promise<CompensationBenchmark> {
    const params = new URLSearchParams({
      role,
      level,
      ...(location && { location }),
    });

    return this.request<CompensationBenchmark>(`/benchmark?${params.toString()}`);
  }

  async getGeographicAdjustments(
    baseLocation: string,
    targetLocations: string[]
  ): Promise<Record<string, number>> {
    return this.request<Record<string, number>>('/geographic-adjustments', {
      method: 'POST',
      body: JSON.stringify({ baseLocation, targetLocations }),
    });
  }

  // ==================== COMPENSATION METHODS ====================

  async getCompanyCompensation(): Promise<CompanyCompensation> {
    return this.request<CompanyCompensation>(`/company/${this.config.companyId}/compensation`);
  }

  async getCompensationByDepartment(): Promise<DepartmentCompensation[]> {
    const data = await this.getCompanyCompensation();
    return data.byDepartment;
  }

  async getCompensationByLevel(): Promise<LevelCompensation[]> {
    const data = await this.getCompanyCompensation();
    return data.byLevel;
  }

  async compareToMarket(
    employees: Array<{ role: string; level: string; salary: number }>
  ): Promise<CompensationComparison[]> {
    return this.request<CompensationComparison[]>('/compare-to-market', {
      method: 'POST',
      body: JSON.stringify({ employees }),
    });
  }

  // ==================== EQUITY METHODS ====================

  async getEquitySummary(): Promise<EquitySummary> {
    return this.request<EquitySummary>(`/company/${this.config.companyId}/equity`);
  }

  async getEquityBurnRate(): Promise<EquitySummary['burnRate']> {
    const summary = await this.getEquitySummary();
    return summary.burnRate;
  }

  async getRefreshGrantsNeeded(): Promise<RefreshGrant[]> {
    const summary = await this.getEquitySummary();
    return summary.refreshGrantsNeeded;
  }

  async getEquityDistribution(): Promise<{
    byDepartment: Array<{ department: string; totalEquity: number; percentage: number }>;
    byLevel: Array<{ level: string; totalEquity: number; percentage: number }>;
    byTenure: Array<{ tenure: string; totalEquity: number; percentage: number }>;
  }> {
    return this.request(`/company/${this.config.companyId}/equity/distribution`);
  }

  // ==================== WIDGET DATA METHODS ====================

  async getCompensationBenchmarkWidgetData(roles?: string[]): Promise<{
    employees: CompensationComparison[];
    summary: {
      atMarket: number;
      aboveMarket: number;
      belowMarket: number;
      significantlyBelow: number;
    };
    avgPercentileRank: number;
  }> {
    const comparisons = await this.compareToMarket(
      roles?.map((r) => ({ role: r, level: 'mid', salary: 0 })) || []
    );

    const summary = {
      atMarket: comparisons.filter((c) => c.recommendation === 'at_market').length,
      aboveMarket: comparisons.filter((c) => c.recommendation === 'above_market').length,
      belowMarket: comparisons.filter((c) => c.recommendation === 'below_market').length,
      significantlyBelow: comparisons.filter((c) => c.recommendation === 'significantly_below')
        .length,
    };

    const avgPercentileRank =
      comparisons.reduce((sum, c) => sum + c.percentileRank, 0) / comparisons.length;

    return {
      employees: comparisons,
      summary,
      avgPercentileRank,
    };
  }

  async getEquityOverviewWidgetData(): Promise<{
    poolUtilization: number;
    burnRate: number;
    refreshGrantsCount: number;
    highPriorityGrants: number;
    distribution: {
      department: string;
      percentage: number;
    }[];
  }> {
    const [summary, distribution] = await Promise.all([
      this.getEquitySummary(),
      this.getEquityDistribution(),
    ]);

    return {
      poolUtilization: (summary.issuedShares / summary.totalPoolShares) * 100,
      burnRate: summary.burnRate.annual,
      refreshGrantsCount: summary.refreshGrantsNeeded.length,
      highPriorityGrants: summary.refreshGrantsNeeded.filter((g) => g.priority === 'high').length,
      distribution: distribution.byDepartment,
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getCompanyCompensation();
      return true;
    } catch {
      return false;
    }
  }
}

export const createPaveConnector = (config: PaveConfig): PaveConnector => {
  return new PaveConnector(config);
};
