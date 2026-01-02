/**
 * @module @skillancer/bi/reports
 * Report generation service with PDF, Excel, CSV support
 */

import { randomUUID } from 'crypto';

import { type S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { getReportById, reportDefinitions } from './definitions.js';

import type {
  ReportRequest,
  ReportResult,
  ReportData,
  ReportSection,
  ScheduledReport,
} from './types.js';
import type { KPIService } from '../kpi/kpi-service.js';
import type { KPIValue } from '../kpi/types.js';

export interface ReportServiceConfig {
  kpiService: KPIService;
  s3Client: S3Client;
  s3Bucket: string;
  s3Prefix?: string;
  reportExpiry?: number; // hours
}

export class ReportService {
  private kpiService: KPIService;
  private s3: S3Client;
  private bucket: string;
  private prefix: string;
  private reportExpiry: number;
  private scheduledReports: Map<string, ScheduledReport> = new Map();

  constructor(config: ReportServiceConfig) {
    this.kpiService = config.kpiService;
    this.s3 = config.s3Client;
    this.bucket = config.s3Bucket;
    this.prefix = config.s3Prefix ?? 'reports/';
    this.reportExpiry = config.reportExpiry ?? 24;
  }

  /**
   * Generate a report in the requested format
   */
  async generateReport(request: ReportRequest): Promise<ReportResult> {
    const resultId = randomUUID();
    const report = getReportById(request.reportId);

    if (!report) {
      return {
        id: resultId,
        reportId: request.reportId,
        format: request.format,
        status: 'failed',
        generatedAt: new Date(),
        expiresAt: new Date(),
        error: `Report not found: ${request.reportId}`,
      };
    }

    try {
      // Gather report data
      const reportData = await this.gatherReportData(request);

      // Generate file based on format
      let buffer: Buffer;
      let contentType: string;
      let extension: string;

      switch (request.format) {
        case 'pdf':
          buffer = await this.generatePDF(reportData);
          contentType = 'application/pdf';
          extension = 'pdf';
          break;
        case 'excel':
          buffer = await this.generateExcel(reportData);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          extension = 'xlsx';
          break;
        case 'csv':
          buffer = await this.generateCSV(reportData);
          contentType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          buffer = Buffer.from(JSON.stringify(reportData, null, 2));
          contentType = 'application/json';
          extension = 'json';
          break;
        default:
          throw new Error(`Unsupported format: ${String(request.format)}`);
      }

      // Upload to S3
      const key = `${this.prefix}${resultId}.${extension}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            reportId: request.reportId,
            generatedAt: new Date().toISOString(),
          },
        })
      );

      // Generate signed URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const downloadUrl = await getSignedUrl(
        this.s3 as any,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }) as any,
        { expiresIn: this.reportExpiry * 3600 }
      );

      return {
        id: resultId,
        reportId: request.reportId,
        format: request.format,
        status: 'completed',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.reportExpiry * 3600 * 1000),
        downloadUrl,
        fileSize: buffer.length,
      };
    } catch (error) {
      return {
        id: resultId,
        reportId: request.reportId,
        format: request.format,
        status: 'failed',
        generatedAt: new Date(),
        expiresAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Schedule a recurring report
   */
  async scheduleReport(
    schedule: Omit<ScheduledReport, 'id' | 'createdAt'>
  ): Promise<ScheduledReport> {
    const id = randomUUID();
    const scheduledReport: ScheduledReport = {
      ...schedule,
      id,
      createdAt: new Date(),
    };

    this.scheduledReports.set(id, scheduledReport);
    return scheduledReport;
  }

  /**
   * Get scheduled reports for a user
   */
  async getScheduledReports(userId: string): Promise<ScheduledReport[]> {
    return Array.from(this.scheduledReports.values()).filter(
      (r) => r.createdBy === userId && r.enabled
    );
  }

  /**
   * Cancel a scheduled report
   */
  async cancelScheduledReport(scheduleId: string): Promise<boolean> {
    const report = this.scheduledReports.get(scheduleId);
    if (report) {
      report.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get available report templates
   */
  getAvailableReports() {
    return reportDefinitions;
  }

  // ==================== Private Methods ====================

  private async gatherReportData(request: ReportRequest): Promise<ReportData> {
    const report = getReportById(request.reportId);
    if (!report) {
      throw new Error(`Report not found: ${request.reportId}`);
    }
    const sections: ReportSection[] = [];

    // Calculate all KPIs for the report
    const kpiValues = await Promise.all(
      report.kpiIds.map((id) =>
        this.kpiService.calculateKPI(id, request.dateRange, {
          comparison: true,
          includeTarget: true,
          dimensions: request.dimensions,
        })
      )
    );

    // Add summary section
    sections.push({
      title: 'Key Metrics Summary',
      type: 'kpi_grid',
      data: kpiValues.map((kpi) => ({
        name: kpi.kpiId,
        value: kpi.formattedValue,
        change: kpi.comparison?.changePercent,
        trend: kpi.comparison?.trend,
        status: kpi.target?.status,
      })),
    });

    // Add detailed table
    sections.push({
      title: 'Detailed Metrics',
      type: 'table',
      data: this.formatKPIsAsTable(kpiValues),
    });

    // Add dimension breakdowns if requested
    if (request.dimensions && request.dimensions.length > 0) {
      for (const dim of request.dimensions) {
        const dimData = kpiValues[0]?.dimensions?.[dim];
        if (dimData) {
          sections.push({
            title: `Breakdown by ${dim}`,
            type: 'chart',
            data: dimData,
          });
        }
      }
    }

    return {
      title: request.customTitle ?? report.name,
      subtitle: report.description,
      generatedAt: new Date(),
      dateRange: request.dateRange,
      sections,
      metadata: {
        reportId: report.id,
        filters: request.filters,
      },
    };
  }

  private async generatePDF(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).text(data.title, { align: 'center' });
      doc.fontSize(12).text(data.subtitle, { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(
          `Generated: ${data.generatedAt.toISOString()} | Period: ${data.dateRange.start.toLocaleDateString()} - ${data.dateRange.end.toLocaleDateString()}`,
          { align: 'center' }
        );
      doc.moveDown(2);

      // Sections
      for (const section of data.sections) {
        doc.fontSize(16).text(section.title);
        doc.moveDown(0.5);

        if (section.type === 'kpi_grid') {
          this.renderPDFKPIGrid(doc, section.data as KPISummary[]);
        } else if (section.type === 'table') {
          this.renderPDFTable(doc, section.data as TableData);
        }

        doc.moveDown(2);
      }

      // Footer
      doc.fontSize(8).text('Skillancer Business Intelligence Report', { align: 'center' });

      doc.end();
    });
  }

  private renderPDFKPIGrid(doc: PDFKit.PDFDocument, kpis: KPISummary[]): void {
    const startX = 50;
    let y = doc.y;

    for (const kpi of kpis) {
      const trendIcon = kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→';
      const changeText =
        kpi.change !== undefined
          ? `${kpi.change > 0 ? '+' : ''}${kpi.change.toFixed(1)}% ${trendIcon}`
          : '';

      doc.fontSize(10).text(kpi.name, startX, y, { continued: true });
      doc.fontSize(12).text(`  ${kpi.value}`, { continued: true });
      doc.fontSize(10).text(`  ${changeText}`);
      y = doc.y + 5;
    }
  }

  private renderPDFTable(doc: PDFKit.PDFDocument, tableData: TableData): void {
    if (!tableData.rows || tableData.rows.length === 0) return;

    const startX = 50;
    const colWidth = (doc.page.width - 100) / tableData.headers.length;
    let y = doc.y;

    // Headers
    doc.font('Helvetica-Bold').fontSize(10);
    tableData.headers.forEach((header, i) => {
      doc.text(header, startX + i * colWidth, y, { width: colWidth });
    });
    y += 20;

    // Rows
    doc.font('Helvetica').fontSize(9);
    for (const row of tableData.rows.slice(0, 20)) {
      row.forEach((cell, i) => {
        doc.text(String(cell), startX + i * colWidth, y, { width: colWidth });
      });
      y += 15;
    }
  }

  private async generateExcel(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Skillancer BI';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'name', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Change', key: 'change', width: 15 },
      { header: 'Trend', key: 'trend', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Add header row styling
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add KPI data
    const kpiSection = data.sections.find((s) => s.type === 'kpi_grid');
    if (kpiSection) {
      const kpis = kpiSection.data as KPISummary[];
      kpis.forEach((kpi) => {
        const row = summarySheet.addRow({
          name: kpi.name,
          value: kpi.value,
          change: kpi.change ? `${kpi.change.toFixed(1)}%` : '-',
          trend: kpi.trend ?? '-',
          status: kpi.status ?? '-',
        });

        // Color code based on trend
        if (kpi.trend === 'up') {
          row.getCell('change').font = { color: { argb: 'FF008000' } };
        } else if (kpi.trend === 'down') {
          row.getCell('change').font = { color: { argb: 'FFFF0000' } };
        }
      });
    }

    // Details sheet
    const detailsSheet = workbook.addWorksheet('Details');
    const tableSection = data.sections.find((s) => s.type === 'table');
    if (tableSection) {
      const tableData = tableSection.data as TableData;
      detailsSheet.addRow(tableData.headers);
      detailsSheet.getRow(1).font = { bold: true };

      tableData.rows.forEach((row) => {
        detailsSheet.addRow(row);
      });
    }

    // Metadata sheet
    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.addRow(['Report', data.title]);
    metaSheet.addRow(['Description', data.subtitle]);
    metaSheet.addRow(['Generated', data.generatedAt.toISOString()]);
    metaSheet.addRow(['Period Start', data.dateRange.start.toISOString()]);
    metaSheet.addRow(['Period End', data.dateRange.end.toISOString()]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async generateCSV(data: ReportData): Promise<Buffer> {
    const lines: string[] = [];

    // Header
    lines.push(`# ${data.title}`);
    lines.push(`# ${data.subtitle}`);
    lines.push(
      `# Generated: ${data.generatedAt.toISOString()}, Period: ${data.dateRange.start.toISOString()} - ${data.dateRange.end.toISOString()}`
    );
    lines.push('');

    // KPI Summary
    const kpiSection = data.sections.find((s) => s.type === 'kpi_grid');
    if (kpiSection) {
      lines.push('Metric,Value,Change,Trend,Status');
      const kpis = kpiSection.data as KPISummary[];
      kpis.forEach((kpi) => {
        lines.push(
          `"${kpi.name}","${kpi.value}","${kpi.change?.toFixed(1) ?? ''}%","${kpi.trend ?? ''}","${kpi.status ?? ''}"`
        );
      });
      lines.push('');
    }

    // Detailed data
    const tableSection = data.sections.find((s) => s.type === 'table');
    if (tableSection) {
      const tableData = tableSection.data as TableData;
      lines.push(tableData.headers.map((h) => `"${h}"`).join(','));
      tableData.rows.forEach((row) => {
        lines.push(row.map((cell) => `"${cell}"`).join(','));
      });
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private formatKPIsAsTable(kpis: KPIValue[]): TableData {
    return {
      headers: ['Metric', 'Current Value', 'Previous Value', 'Change', 'Target', 'Progress'],
      rows: kpis.map((kpi) => [
        kpi.kpiId,
        kpi.formattedValue,
        kpi.comparison?.previousValue?.toFixed(2) ?? '-',
        kpi.comparison ? `${kpi.comparison.changePercent.toFixed(1)}%` : '-',
        kpi.target?.value?.toFixed(2) ?? '-',
        kpi.target ? `${kpi.target.progress.toFixed(1)}%` : '-',
      ]),
    };
  }
}

// Helper types
interface KPISummary {
  name: string;
  value: string;
  change?: number;
  trend?: string;
  status?: string;
}

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}
