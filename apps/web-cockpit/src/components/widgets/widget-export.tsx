'use client';

/**
 * Widget Export Component - Export widget data and visuals
 */

import { useState } from 'react';
import { Download, Image, FileText, Copy, Check } from 'lucide-react';
import { Button } from '@skillancer/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@skillancer/ui/components/dropdown-menu';

interface WidgetExportProps {
  widgetId: string;
  widgetTitle: string;
  data: unknown;
  elementRef?: React.RefObject<HTMLElement>;
}

export function WidgetExport({ widgetId, widgetTitle, data, elementRef }: WidgetExportProps) {
  const [copied, setCopied] = useState(false);

  // Export as CSV
  const exportCSV = () => {
    const csvData = convertToCSV(data);
    downloadFile(csvData, `${widgetId}-export.csv`, 'text/csv');
  };

  // Export as JSON
  const exportJSON = () => {
    const jsonData = JSON.stringify(data, null, 2);
    downloadFile(jsonData, `${widgetId}-export.json`, 'application/json');
  };

  // Export as PNG (requires html2canvas)
  const exportPNG = async () => {
    if (!elementRef?.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(elementRef.current);
      const link = document.createElement('a');
      link.download = `${widgetId}-export.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('PNG export failed:', error);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJSON}>
          <FileText className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        {elementRef && (
          <DropdownMenuItem onClick={exportPNG}>
            <Image className="mr-2 h-4 w-4" />
            Export as PNG
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={copyToClipboard}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Helper: Convert data to CSV
function convertToCSV(data: unknown): string {
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0] as object);
    const rows = data.map((item) =>
      headers.map((h) => JSON.stringify((item as Record<string, unknown>)[h] ?? '')).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data);
    return entries.map(([key, value]) => `${key},${JSON.stringify(value)}`).join('\n');
  }

  return String(data);
}

// Helper: Download file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default WidgetExport;
