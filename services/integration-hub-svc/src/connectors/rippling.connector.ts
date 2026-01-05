import { EventEmitter } from 'node:events';

// Rippling Connector
//
// Authentication: API Token
//
// Supported Widgets:
// - Unified HRIS + Payroll + Benefits view
// - Similar to BambooHR + Gusto combined

interface RipplingConfig {
  apiToken: string;
  companyId?: string;
}

interface Company {
  id: string;
  name: string;
  legalName: string;
  ein: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  primaryContact: {
    name: string;
    email: string;
  };
}

interface Employee {
  id: string;
  personalEmail: string;
  workEmail: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  department: string;
  departmentId: string;
  title: string;
  managerId: string;
  managerName: string;
  startDate: string;
  endDate?: string;
  employmentType: 'full_time' | 'part_time' | 'contractor' | 'intern';
  employmentStatus: 'active' | 'terminated' | 'leave' | 'onboarding';
  location: {
    city: string;
    state: string;
    country: string;
  };
  compensation?: {
    salary: number;
    payFrequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
    currency: string;
  };
}

interface Department {
  id: string;
  name: string;
  parentId?: string;
  managerId?: string;
  employeeCount: number;
}

interface PayrollSummary {
  lastPayrollDate: string;
  lastPayrollAmount: number;
  nextPayrollDate: string;
  estimatedNextAmount: number;
  ytdGrossPay: number;
  ytdTaxes: number;
  ytdBenefits: number;
}

interface BenefitsEnrollment {
  totalEligible: number;
  totalEnrolled: number;
  enrollmentRate: number;
  plans: Array<{
    planType: string;
    planName: string;
    enrolledCount: number;
    monthlyCompanyCost: number;
    monthlyEmployeeCost: number;
  }>;
}

interface HeadcountData {
  total: number;
  active: number;
  onLeave: number;
  onboarding: number;
  byDepartment: Record<string, number>;
  byLocation: Record<string, number>;
  byEmploymentType: Record<string, number>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

interface OrgChange {
  type: 'new_hire' | 'termination' | 'promotion' | 'department_change' | 'manager_change';
  employeeId: string;
  employeeName: string;
  effectiveDate: string;
  details: Record<string, string>;
}

export class RipplingConnector extends EventEmitter {
  private config: RipplingConfig;
  private baseUrl = 'https://api.rippling.com/platform/api';

  constructor(config: RipplingConfig) {
    super();
    this.config = config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Rippling API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== COMPANY METHODS ====================

  async getCompany(): Promise<Company> {
    return this.request<Company>('/companies/me');
  }

  // ==================== EMPLOYEE METHODS ====================

  async getEmployees(filters?: {
    status?: string;
    department?: string;
    managerId?: string;
  }): Promise<Employee[]> {
    let endpoint = '/employees';
    const params = new URLSearchParams();

    if (filters?.status) params.append('employment_status', filters.status);
    if (filters?.department) params.append('department_id', filters.department);
    if (filters?.managerId) params.append('manager_id', filters.managerId);

    if (params.toString()) endpoint += `?${params.toString()}`;

    const data = await this.request<{ data: Employee[] }>(endpoint);
    return data.data;
  }

  async getEmployee(employeeId: string): Promise<Employee> {
    return this.request<Employee>(`/employees/${employeeId}`);
  }

  // ==================== DEPARTMENT METHODS ====================

  async getDepartments(): Promise<Department[]> {
    const data = await this.request<{ data: Department[] }>('/departments');
    return data.data;
  }

  async getDepartment(departmentId: string): Promise<Department> {
    return this.request<Department>(`/departments/${departmentId}`);
  }

  // ==================== PAYROLL METHODS ====================

  async getPayrollSummary(): Promise<PayrollSummary> {
    // Would use Rippling's payroll endpoints
    const payrollData = await this.request<{
      lastPayroll: {
        date: string;
        totalAmount: number;
      };
      nextPayroll: {
        date: string;
        estimatedAmount: number;
      };
      ytd: {
        grossPay: number;
        taxes: number;
        benefits: number;
      };
    }>('/payroll/summary');

    return {
      lastPayrollDate: payrollData.lastPayroll.date,
      lastPayrollAmount: payrollData.lastPayroll.totalAmount,
      nextPayrollDate: payrollData.nextPayroll.date,
      estimatedNextAmount: payrollData.nextPayroll.estimatedAmount,
      ytdGrossPay: payrollData.ytd.grossPay,
      ytdTaxes: payrollData.ytd.taxes,
      ytdBenefits: payrollData.ytd.benefits,
    };
  }

  // ==================== BENEFITS METHODS ====================

  async getBenefitsEnrollment(): Promise<BenefitsEnrollment> {
    const benefitsData = await this.request<{
      summary: {
        eligible: number;
        enrolled: number;
      };
      plans: Array<{
        type: string;
        name: string;
        enrolled: number;
        companyCost: number;
        employeeCost: number;
      }>;
    }>('/benefits/enrollment/summary');

    return {
      totalEligible: benefitsData.summary.eligible,
      totalEnrolled: benefitsData.summary.enrolled,
      enrollmentRate:
        benefitsData.summary.eligible > 0
          ? (benefitsData.summary.enrolled / benefitsData.summary.eligible) * 100
          : 0,
      plans: benefitsData.plans.map((p) => ({
        planType: p.type,
        planName: p.name,
        enrolledCount: p.enrolled,
        monthlyCompanyCost: p.companyCost,
        monthlyEmployeeCost: p.employeeCost,
      })),
    };
  }

  // ==================== WIDGET DATA METHODS ====================

  async getHeadcountData(): Promise<HeadcountData> {
    const employees = await this.getEmployees();
    const departments = await this.getDepartments();

    const byDepartment: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const byEmploymentType: Record<string, number> = {};

    let active = 0;
    let onLeave = 0;
    let onboarding = 0;

    for (const emp of employees) {
      // Count by status
      if (emp.employmentStatus === 'active') active++;
      else if (emp.employmentStatus === 'leave') onLeave++;
      else if (emp.employmentStatus === 'onboarding') onboarding++;

      // Count by department
      byDepartment[emp.department] = (byDepartment[emp.department] || 0) + 1;

      // Count by location
      const location = emp.location?.city || 'Unknown';
      byLocation[location] = (byLocation[location] || 0) + 1;

      // Count by employment type
      byEmploymentType[emp.employmentType] = (byEmploymentType[emp.employmentType] || 0) + 1;
    }

    // Build monthly trend (would need historical data endpoint)
    const monthlyTrend: Array<{ month: string; count: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrend.push({
        month: date.toISOString().slice(0, 7),
        count: employees.filter((e) => e.employmentStatus !== 'terminated').length,
      });
    }

    return {
      total: employees.length,
      active,
      onLeave,
      onboarding,
      byDepartment,
      byLocation,
      byEmploymentType,
      monthlyTrend,
    };
  }

  async getRecentOrgChanges(daysBack: number = 30): Promise<OrgChange[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const employees = await this.getEmployees();
    const changes: OrgChange[] = [];

    for (const emp of employees) {
      const startDate = new Date(emp.startDate);
      if (startDate >= cutoffDate && emp.employmentStatus !== 'terminated') {
        changes.push({
          type: 'new_hire',
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          effectiveDate: emp.startDate,
          details: {
            department: emp.department,
            title: emp.title,
          },
        });
      }

      if (emp.endDate) {
        const endDate = new Date(emp.endDate);
        if (endDate >= cutoffDate) {
          changes.push({
            type: 'termination',
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            effectiveDate: emp.endDate,
            details: {
              department: emp.department,
              title: emp.title,
            },
          });
        }
      }
    }

    return changes.sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
  }

  async getUnifiedHROverview(): Promise<{
    headcount: HeadcountData;
    payroll: PayrollSummary;
    benefits: BenefitsEnrollment;
    recentChanges: OrgChange[];
  }> {
    const [headcount, payroll, benefits, recentChanges] = await Promise.all([
      this.getHeadcountData(),
      this.getPayrollSummary(),
      this.getBenefitsEnrollment(),
      this.getRecentOrgChanges(),
    ]);

    return { headcount, payroll, benefits, recentChanges };
  }

  // ==================== ORG CHART DATA ====================

  async getOrgChartData(): Promise<
    Array<{
      id: string;
      name: string;
      title: string;
      department: string;
      managerId: string | null;
      photoUrl?: string;
    }>
  > {
    const employees = await this.getEmployees({ status: 'active' });

    return employees.map((emp) => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      title: emp.title,
      department: emp.department,
      managerId: emp.managerId || null,
      photoUrl: undefined, // Would come from employee photo endpoint
    }));
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getCompany();
      return true;
    } catch {
      return false;
    }
  }
}

export const createRipplingConnector = (config: RipplingConfig): RipplingConnector => {
  return new RipplingConnector(config);
};
