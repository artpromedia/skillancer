'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { GitMerge, TrendingUp, ArrowRight } from 'lucide-react';

type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';

interface ChannelAttribution {
  channel: string;
  credit: number;
  percentage: number;
  conversions: number;
  revenue: number;
}

interface AttributionWidgetProps {
  engagementId: string;
  data?: {
    model: AttributionModel;
    byChannel: ChannelAttribution[];
    totalConversions: number;
    totalRevenue: number;
  };
  isLoading?: boolean;
  onModelChange?: (model: AttributionModel) => void;
}

const modelLabels: Record<AttributionModel, string> = {
  first_touch: 'First Touch',
  last_touch: 'Last Touch',
  linear: 'Linear',
  time_decay: 'Time Decay',
  position_based: 'Position Based',
};

const channelColors: Record<string, string> = {
  'Organic Search': '#22c55e',
  'Paid Search': '#3b82f6',
  Social: '#8b5cf6',
  Email: '#f59e0b',
  Direct: '#6b7280',
  Referral: '#ec4899',
  Display: '#06b6d4',
};

export function AttributionWidget({
  engagementId,
  data,
  isLoading,
  onModelChange,
}: AttributionWidgetProps) {
  const [selectedModel, setSelectedModel] = useState<AttributionModel>(data?.model || 'linear');

  const handleModelChange = (model: AttributionModel) => {
    setSelectedModel(model);
    onModelChange?.(model);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Multi-touch Attribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 rounded bg-gray-100" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxPercentage = Math.max(...(data?.byChannel?.map((c) => c.percentage) || [1]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Multi-touch Attribution
          </CardTitle>
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold">{data?.totalConversions || 0}</div>
            <div className="text-muted-foreground text-sm">Conversions</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold">
              ${((data?.totalRevenue || 0) / 1000).toFixed(1)}K
            </div>
            <div className="text-muted-foreground text-sm">Revenue</div>
          </div>
        </div>

        {/* Attribution Chart */}
        <div className="space-y-3">
          {data?.byChannel?.map((channel) => (
            <div key={channel.channel} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{channel.channel}</span>
                <span className="text-muted-foreground">
                  {channel.percentage.toFixed(1)}% • ${channel.revenue.toFixed(0)}
                </span>
              </div>
              <div className="h-6 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(channel.percentage / maxPercentage) * 100}%`,
                    backgroundColor: channelColors[channel.channel] || '#3b82f6',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Model Explanation */}
        <div className="mt-6 rounded-lg bg-blue-50 p-3">
          <h4 className="mb-1 text-sm font-medium text-blue-900">
            {modelLabels[selectedModel]} Model
          </h4>
          <p className="text-xs text-blue-700">
            {selectedModel === 'first_touch' && '100% credit to the first marketing touchpoint.'}
            {selectedModel === 'last_touch' &&
              '100% credit to the last touchpoint before conversion.'}
            {selectedModel === 'linear' && 'Equal credit distributed across all touchpoints.'}
            {selectedModel === 'time_decay' && 'More credit to touchpoints closer to conversion.'}
            {selectedModel === 'position_based' &&
              '40% first, 40% last, 20% split across middle touchpoints.'}
          </p>
        </div>

        {/* Journey Preview */}
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium">Sample Journey</h4>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
            <div className="flex-shrink-0 rounded bg-green-100 px-2 py-1 text-green-800">
              Organic Search
            </div>
            <ArrowRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
            <div className="flex-shrink-0 rounded bg-purple-100 px-2 py-1 text-purple-800">
              Social
            </div>
            <ArrowRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
            <div className="flex-shrink-0 rounded bg-amber-100 px-2 py-1 text-amber-800">Email</div>
            <ArrowRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
            <div className="flex-shrink-0 rounded bg-blue-100 px-2 py-1 text-blue-800">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              Conversion
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
