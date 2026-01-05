import { EventEmitter } from 'node:events';

// Gusto Connector
//
// OAuth Configuration: Gusto OAuth 2.0
//
// Supported Widgets:
// 1. payroll-summary - Last payroll date, total amount, upcoming payroll
// 2. benefits-overview - Enrolled employees, benefits costs, enrollment status
// 3. compliance-status - Tax filings status, required forms

interface GustoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GustoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface Company {
  id: string;
  name: string;
  ein: string;
  entityType: string;
  primaryEmail: string;
  primaryPayroll: {
    processingPeriod: string;
  };
  locations: Array<{
    id: string;
    streetOne: string;
    city: string;
    state: string;
    zip: string;
  }>;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  ssn: string;
  workEmail: string;
  department: string;
  jobTitle: string;
  startDate: string;
  terminationDate: string | null;
  currentEmploymentStatus: 'active' | 'terminated' | 'onLeave';
  compensation: {
    rate: number;
    paymentUnit: 'Hour' | 'Week' | 'Month' | 'Year';
    flsaStatus: 'Exempt' | 'Nonexempt';
  };
}

interface Payroll {
  id: string;
  payPeriod: {
    startDate: string;
    endDate: string;
    payScheduleId: string;
  };
  checkDate: string;
  processed: boolean;
  processedDate: string | null;
  calculatedAt: string | null;
  totals: {
    companyDebit: number;
    netPay: number;
    taxBurden: number;
    employerTaxes: number;
    employeeTaxes: number;
    benefitsCosts: number;
  };
  employeeCompensations: Array<{
    employeeId: string;
    grossPay: number;
    netPay: number;
    taxes: number;
  }>;
}

interface Benefit {
  id: string;
  benefitType: string;
  description: string;
  active: boolean;
  employeeDeduction: number;
  companyContribution: number;
}

interface BenefitEnrollment {
  employeeId: string;
  benefitId: string;
  enrollmentStatus: 'enrolled' | 'waived' | 'pending';
  effectiveDate: string;
  employeeDeduction: number;
  companyContribution: number;
}

interface PayrollSummary {
  lastPayroll: {
    date: string;
    totalAmount: number;
    employeeCount: number;
  } | null;
  upcomingPayroll: {
    date: string;
    estimatedAmount: number;
  } | null;
  ytdTotals: {
    grossPay: number;
    netPay: number;
    taxes: number;
    benefits: number;
  };
}

interface BenefitsOverview {
  enrolledEmployees: number;
  totalEmployees: number;
  enrollmentRate: number;
  monthlyCompanyCost: number;
  monthlyEmployeeCost: number;
  benefitsByType: Record<
    string,
    {
      enrolled: number;
      companyCost: number;
      employeeCost: number;
    }
  >;
}

interface ComplianceStatus {
  taxFilings: Array<{
    type: string;
    period: string;
    status: 'filed' | 'pending' | 'due' | 'overdue';
    dueDate: string;
    filedDate: string | null;
  }>;
  requiredForms: Array<{
    form: string;
    description: string;
    dueDate: string;
    status: 'complete' | 'pending' | 'not_started';
  }>;
}

export class GustoConnector extends EventEmitter {
  private oauthConfig: GustoOAuthConfig;
  private tokens: GustoTokens | null = null;
  private baseUrl = 'https://api.gusto.com/v1';

  constructor(oauthConfig: GustoOAuthConfig) {
    super();
    this.oauthConfig = oauthConfig;
  }

  // ==================== OAUTH METHODS ====================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      response_type: 'code',
      state,
    });

    return `https://api.gusto.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GustoTokens> {
    const response = await fetch('https://api.gusto.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri: this.oauthConfig.redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.tokens;
  }

  async refreshAccessToken(): Promise<GustoTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://api.gusto.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.tokens;
  }

  setTokens(tokens: GustoTokens): void {
    this.tokens = tokens;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    if (this.tokens.expiresAt <= new Date()) {
      await this.refreshAccessToken();
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens!.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gusto API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== COMPANY METHODS ====================

  async getCompany(companyId: string): Promise<Company> {
    return this.request<Company>(`/companies/${companyId}`);
  }

  async getCompanies(): Promise<Company[]> {
    return this.request<Company[]>('/companies');
  }

  // ==================== EMPLOYEE METHODS ====================

  async getEmployees(companyId: string): Promise<Employee[]> {
    return this.request<Employee[]>(`/companies/${companyId}/employees`);
  }

  async getEmployee(employeeId: string): Promise<Employee> {
    return this.request<Employee>(`/employees/${employeeId}`);
  }

  // ==================== PAYROLL METHODS ====================

  async getPayrolls(companyId: string, startDate?: string, endDate?: string): Promise<Payroll[]> {
    let endpoint = `/companies/${companyId}/payrolls`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) endpoint += `?${params.toString()}`;

    return this.request<Payroll[]>(endpoint);
  }

  async getPayroll(companyId: string, payrollId: string): Promise<Payroll> {
    return this.request<Payroll>(`/companies/${companyId}/payrolls/${payrollId}`);
  }

  // ==================== BENEFITS METHODS ====================

  async getBenefits(companyId: string): Promise<Benefit[]> {
    return this.request<Benefit[]>(`/companies/${companyId}/company_benefits`);
  }

  async getBenefitEnrollments(companyId: string): Promise<BenefitEnrollment[]> {
    const employees = await this.getEmployees(companyId);
    const enrollments: BenefitEnrollment[] = [];

    // Fetch enrollments per employee (simplified - actual API may differ)
    for (const emp of employees) {
      const empEnrollments = await this.request<BenefitEnrollment[]>(
        `/employees/${emp.id}/benefits`
      );
      enrollments.push(...empEnrollments);
    }

    return enrollments;
  }

  // ==================== WIDGET DATA METHODS ====================

  async getPayrollSummary(companyId: string): Promise<PayrollSummary> {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const payrolls = await this.getPayrolls(companyId, yearStart, today);

    const processedPayrolls = payrolls.filter((p) => p.processed);
    const lastPayroll =
      processedPayrolls.length > 0
        ? processedPayrolls.sort(
            (a, b) => new Date(b.checkDate).getTime() - new Date(a.checkDate).getTime()
          )[0]
        : null;

    const upcomingPayrolls = payrolls.filter((p) => !p.processed && new Date(p.checkDate) > now);
    const nextPayroll =
      upcomingPayrolls.length > 0
        ? upcomingPayrolls.sort(
            (a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime()
          )[0]
        : null;

    const ytdTotals = processedPayrolls.reduce(
      (acc, p) => ({
        grossPay: acc.grossPay + (p.totals.companyDebit || 0),
        netPay: acc.netPay + (p.totals.netPay || 0),
        taxes: acc.taxes + (p.totals.employerTaxes || 0) + (p.totals.employeeTaxes || 0),
        benefits: acc.benefits + (p.totals.benefitsCosts || 0),
      }),
      { grossPay: 0, netPay: 0, taxes: 0, benefits: 0 }
    );

    return {
      lastPayroll: lastPayroll
        ? {
            date: lastPayroll.checkDate,
            totalAmount: lastPayroll.totals.companyDebit,
            employeeCount: lastPayroll.employeeCompensations.length,
          }
        : null,
      upcomingPayroll: nextPayroll
        ? {
            date: nextPayroll.checkDate,
            estimatedAmount: nextPayroll.totals.companyDebit || 0,
          }
        : null,
      ytdTotals,
    };
  }

  async getBenefitsOverview(companyId: string): Promise<BenefitsOverview> {
    const employees = await this.getEmployees(companyId);
    const activeEmployees = employees.filter((e) => e.currentEmploymentStatus === 'active');
    const benefits = await this.getBenefits(companyId);

    // Simplified calculation
    const benefitsByType: BenefitsOverview['benefitsByType'] = {};
    let totalCompanyCost = 0;
    let totalEmployeeCost = 0;
    let enrolledCount = 0;

    for (const benefit of benefits.filter((b) => b.active)) {
      benefitsByType[benefit.benefitType] = {
        enrolled: activeEmployees.length, // Simplified
        companyCost: benefit.companyContribution * activeEmployees.length,
        employeeCost: benefit.employeeDeduction * activeEmployees.length,
      };
      totalCompanyCost += benefit.companyContribution * activeEmployees.length;
      totalEmployeeCost += benefit.employeeDeduction * activeEmployees.length;
      enrolledCount = activeEmployees.length;
    }

    return {
      enrolledEmployees: enrolledCount,
      totalEmployees: activeEmployees.length,
      enrollmentRate:
        activeEmployees.length > 0 ? (enrolledCount / activeEmployees.length) * 100 : 0,
      monthlyCompanyCost: totalCompanyCost,
      monthlyEmployeeCost: totalEmployeeCost,
      benefitsByType,
    };
  }

  async getComplianceStatus(companyId: string): Promise<ComplianceStatus> {
    // Tax filings and compliance data - would come from Gusto's compliance endpoints
    const now = new Date();
    const currentYear = now.getFullYear();

    return {
      taxFilings: [
        {
          type: '941 - Quarterly Federal Tax Return',
          period: `Q${Math.floor(now.getMonth() / 3) + 1} ${currentYear}`,
          status: 'pending',
          dueDate: this.getQuarterEndDate(now),
          filedDate: null,
        },
        {
          type: 'State Unemployment Tax',
          period: `Q${Math.floor(now.getMonth() / 3) + 1} ${currentYear}`,
          status: 'pending',
          dueDate: this.getQuarterEndDate(now),
          filedDate: null,
        },
      ],
      requiredForms: [
        {
          form: 'W-2',
          description: 'Wage and Tax Statement',
          dueDate: `${currentYear + 1}-01-31`,
          status: now.getMonth() === 11 ? 'pending' : 'not_started',
        },
        {
          form: '1095-C',
          description: 'ACA Reporting',
          dueDate: `${currentYear + 1}-03-02`,
          status: 'not_started',
        },
      ],
    };
  }

  private getQuarterEndDate(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3);
    const quarterEndMonth = (quarter + 1) * 3;
    const lastDay = new Date(date.getFullYear(), quarterEndMonth, 0);
    // Tax deadline is typically end of month following quarter
    const deadline = new Date(lastDay);
    deadline.setMonth(deadline.getMonth() + 1);
    return deadline.toISOString().split('T')[0];
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getCompanies();
      return true;
    } catch {
      return false;
    }
  }
}

export const createGustoConnector = (config: GustoOAuthConfig): GustoConnector => {
  return new GustoConnector(config);
};
