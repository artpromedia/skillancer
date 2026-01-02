'use client';

/**
 * Widget Settings Modal - Configure widget display and behavior
 */

import { Button } from '@skillancer/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/components/dialog';
import { Input } from '@skillancer/ui/components/input';
import { Label } from '@skillancer/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/components/select';
import { Switch } from '@skillancer/ui/components/switch';
import { useState } from 'react';

interface WidgetSettings {
  refreshInterval: number;
  autoRefresh: boolean;
  compactMode: boolean;
  showTrends: boolean;
  alertThreshold?: number;
}

interface WidgetSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  widgetName: string;
  currentSettings: WidgetSettings;
  onSave: (settings: WidgetSettings) => void;
}

const REFRESH_OPTIONS = [
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
];

export function WidgetSettingsModal({
  open,
  onOpenChange,
  widgetName,
  currentSettings,
  onSave,
}: WidgetSettingsModalProps) {
  const [settings, setSettings] = useState<WidgetSettings>(currentSettings);

  const handleSave = () => {
    onSave(settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{widgetName} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Refresh Interval */}
          <div className="space-y-2">
            <Label>Refresh Interval</Label>
            <Select
              value={String(settings.refreshInterval)}
              onValueChange={(v) => setSettings({ ...settings, refreshInterval: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto Refresh */}
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
            <Switch
              checked={settings.autoRefresh}
              id="auto-refresh"
              onCheckedChange={(checked) => setSettings({ ...settings, autoRefresh: checked })}
            />
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <Label htmlFor="compact-mode">Compact Mode</Label>
            <Switch
              checked={settings.compactMode}
              id="compact-mode"
              onCheckedChange={(checked) => setSettings({ ...settings, compactMode: checked })}
            />
          </div>

          {/* Show Trends */}
          <div className="flex items-center justify-between">
            <Label htmlFor="show-trends">Show Trends</Label>
            <Switch
              checked={settings.showTrends}
              id="show-trends"
              onCheckedChange={(checked) => setSettings({ ...settings, showTrends: checked })}
            />
          </div>

          {/* Alert Threshold */}
          <div className="space-y-2">
            <Label htmlFor="alert-threshold">Alert Threshold (optional)</Label>
            <Input
              id="alert-threshold"
              placeholder="Enter threshold value"
              type="number"
              value={settings.alertThreshold ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alertThreshold: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WidgetSettingsModal;
