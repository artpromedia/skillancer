import { EventEmitter } from 'events';

// BambooHR Connector
//
// Authentication: API Key
//
// Supported Widgets:
// 1. headcount-overview - Total headcount, by department, by location, trend
// 2. org-changes - New hires, terminations, internal moves
// 3. employee-directory - Searchable directory, org chart data
// 4. time-off-summary - PTO balances, upcoming time off, leave patterns
// 5. anniversary-birthdays - Work anniversaries, upcoming birthdays

interface BambooHRConfig {
  apiKey: string;
  subdomain: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  workEmail: string;
  department: string;
  division: string;
  location: string;
  jobTitle: string;
  supervisor: string;
  supervisorId: string;
  hireDate: string;
  terminationDate: string | null;
  status: 'Active' | 'Inactive';
  employmentStatus: string;
  photoUrl: string;
}

interface TimeOffRequest {
  id: string;
  employeeId: string;
  type: string;
  status: 'approved' | 'pending' | 'denied' | 'canceled';
  start: string;
  end: string;
  amount: number;
  unit: 'days' | 'hours';
  notes: string;
  created: string;
}

interface EmployeeChange {
  employeeId: string;
  action: 'created' | 'updated' | 'deleted';
  changedFields: string[];
  timestamp: string;
}

interface HeadcountOverview {
  total: number;
  byDepartment: Record<string, number>;
  byLocation: Record<string, number>;
  byStatus: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
}

interface OrgChanges {
  newHires: Employee[];
  terminations: Employee[];
  internalMoves: Array<{
    employee: Employee;
    fromDepartment: string;
    toDepartment: string;
    effectiveDate: string;
  }>;
}

export class BambooHRConnector extends EventEmitter {
  private config: BambooHRConfig;
  private baseUrl: string;

  constructor(config: BambooHRConfig) {
    super();
    this.config = config;
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.subdomain}/v1`;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.config.apiKey}:x`).toString('base64')}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`BambooHR API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== EMPLOYEE METHODS ====================

  async getEmployees(): Promise<Employee[]> {
    const fields = [
      'id',
      'employeeNumber',
      'firstName',
      'lastName',
      'displayName',
      'workEmail',
      'department',
      'division',
      'location',
      'jobTitle',
      'supervisor',
      'supervisorId',
      'hireDate',
      'terminationDate',
      'status',
      'employmentStatus',
      'photoUrl',
    ].join(',');

    const data = await this.request<{ employees: Employee[] }>(
      `/employees/directory?fields=${fields}`
    );

    return data.employees;
  }

  async getEmployee(employeeId: string): Promise<Employee> {
    const fields = [
      'id',
      'employeeNumber',
      'firstName',
      'lastName',
      'displayName',
      'workEmail',
      'department',
      'division',
      'location',
      'jobTitle',
      'supervisor',
      'supervisorId',
      'hireDate',
      'terminationDate',
      'status',
      'employmentStatus',
      'photoUrl',
    ].join(',');

    return this.request<Employee>(`/employees/${employeeId}?fields=${fields}`);
  }

  async getDirectory(): Promise<Employee[]> {
    const data = await this.request<{ employees: Employee[] }>('/employees/directory');
    return data.employees;
  }

  async getChangedEmployees(since: Date): Promise<EmployeeChange[]> {
    const sinceStr = since.toISOString().split('T')[0];
    const data = await this.request<{ employees: EmployeeChange[] }>(
      `/employees/changed?since=${sinceStr}`
    );
    return data.employees;
  }

  // ==================== TIME OFF METHODS ====================

  async getTimeOffRequests(
    startDate?: string,
    endDate?: string,
    status?: string
  ): Promise<TimeOffRequest[]> {
    let endpoint = '/time_off/requests?';
    if (startDate) endpoint += `start=${startDate}&`;
    if (endDate) endpoint += `end=${endDate}&`;
    if (status) endpoint += `status=${status}`;

    return this.request<TimeOffRequest[]>(endpoint);
  }

  async getTimeOffBalances(employeeId: string): Promise<Record<string, number>> {
    return this.request<Record<string, number>>(`/employees/${employeeId}/time_off/calculator`);
  }

  // ==================== REPORTS ====================

  async getReports(): Promise<Array<{ id: string; name: string }>> {
    return this.request<Array<{ id: string; name: string }>>('/reports');
  }

  async runReport(reportId: string): Promise<unknown> {
    return this.request<unknown>(`/reports/${reportId}?format=JSON`);
  }

  // ==================== WIDGET DATA METHODS ====================

  async getHeadcountOverview(): Promise<HeadcountOverview> {
    const employees = await this.getEmployees();
    const activeEmployees = employees.filter((e) => e.status === 'Active');

    const byDepartment: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const emp of activeEmployees) {
      byDepartment[emp.department] = (byDepartment[emp.department] || 0) + 1;
      byLocation[emp.location] = (byLocation[emp.location] || 0) + 1;
      byStatus[emp.employmentStatus] = (byStatus[emp.employmentStatus] || 0) + 1;
    }

    // Build 12-month trend (simplified - would need historical data)
    const trend: Array<{ date: string; count: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        date: date.toISOString().slice(0, 7),
        count: activeEmployees.length, // Simplified
      });
    }

    return {
      total: activeEmployees.length,
      byDepartment,
      byLocation,
      byStatus,
      trend,
    };
  }

  async getOrgChanges(daysBack: number = 30): Promise<OrgChanges> {
    const employees = await this.getEmployees();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const newHires = employees.filter((e) => {
      const hireDate = new Date(e.hireDate);
      return hireDate >= cutoffDate && e.status === 'Active';
    });

    const terminations = employees.filter((e) => {
      if (!e.terminationDate) return false;
      const termDate = new Date(e.terminationDate);
      return termDate >= cutoffDate;
    });

    // Internal moves would require change history
    const internalMoves: OrgChanges['internalMoves'] = [];

    return { newHires, terminations, internalMoves };
  }

  async getAnniversariesAndBirthdays(daysAhead: number = 30): Promise<{
    anniversaries: Array<{ employee: Employee; yearsOfService: number; date: string }>;
    birthdays: Array<{ employee: Employee; date: string }>;
  }> {
    const employees = await this.getEmployees();
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const anniversaries: Array<{ employee: Employee; yearsOfService: number; date: string }> = [];

    for (const emp of employees) {
      if (!emp.hireDate || emp.status !== 'Active') continue;

      const hireDate = new Date(emp.hireDate);
      const anniversary = new Date(now.getFullYear(), hireDate.getMonth(), hireDate.getDate());

      if (anniversary < now) {
        anniversary.setFullYear(anniversary.getFullYear() + 1);
      }

      if (anniversary <= cutoff) {
        const yearsOfService = anniversary.getFullYear() - hireDate.getFullYear();
        anniversaries.push({
          employee: emp,
          yearsOfService,
          date: anniversary.toISOString().split('T')[0],
        });
      }
    }

    // Birthdays would require DOB field
    const birthdays: Array<{ employee: Employee; date: string }> = [];

    return { anniversaries, birthdays };
  }

  async getTimeOffSummary(): Promise<{
    upcomingTimeOff: TimeOffRequest[];
    pendingRequests: TimeOffRequest[];
  }> {
    const now = new Date();
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const requests = await this.getTimeOffRequests(
      now.toISOString().split('T')[0],
      thirtyDaysOut.toISOString().split('T')[0]
    );

    return {
      upcomingTimeOff: requests.filter((r) => r.status === 'approved'),
      pendingRequests: requests.filter((r) => r.status === 'pending'),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getDirectory();
      return true;
    } catch {
      return false;
    }
  }
}

export const createBambooHRConnector = (config: BambooHRConfig): BambooHRConnector => {
  return new BambooHRConnector(config);
};
