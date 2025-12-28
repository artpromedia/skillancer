'use client';

import { cn } from '@skillancer/ui';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useState } from 'react';

interface SkillTrend {
  id: string;
  name: string;
  category: string;
  growth: number;
  demandLevel: 'exploding' | 'high' | 'growing' | 'stable' | 'declining';
  jobPostings: number;
  avgSalary: string;
  yearlySalaryGrowth: number;
  hasSkill: boolean;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  topEmployers: string[];
  relatedSkills: string[];
  historicalData: { month: string; value: number }[];
}

interface TrendChartProps {
  trends: SkillTrend[];
  timeRange: '3m' | '6m' | '1y' | '2y';
}

export function TrendChart({ trends, timeRange: _timeRange }: Readonly<TrendChartProps>) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(trends.slice(0, 3).map((t) => t.id))
  );
  const [hoveredPoint, setHoveredPoint] = useState<{
    skillId: string;
    month: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const colors = [
    '#4F46E5', // indigo
    '#7C3AED', // purple
    '#EC4899', // pink
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#06B6D4', // cyan
    '#84CC16', // lime
  ];

  const getColor = (index: number) => colors[index % colors.length];

  // Get selected trends data
  const selectedTrends = trends.filter((t) => selectedSkills.has(t.id));

  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 20, right: 40, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Get all months and values for scaling
  const allMonths = selectedTrends[0]?.historicalData.map((d) => d.month) || [];
  const allValues = selectedTrends.flatMap((t) => t.historicalData.map((d) => d.value));
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);

  // Scale functions
  const xScale = (index: number) => padding.left + (index / (allMonths.length - 1)) * innerWidth;
  const yScale = (value: number) =>
    padding.top + innerHeight - ((value - minValue) / (maxValue - minValue)) * innerHeight;

  // Generate path for a trend
  const generatePath = (data: { month: string; value: number }[]) => {
    return data
      .map((point, i) => {
        const x = xScale(i);
        const y = yScale(point.value);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Skill Demand Over Time</h3>
          <p className="text-sm text-gray-500">Compare how different skills are trending</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Chart */}
        <div className="flex-1">
          <svg
            className="overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width="100%"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const y = padding.top + (innerHeight * (100 - percent)) / 100;
              const value = minValue + ((maxValue - minValue) * percent) / 100;
              return (
                <g key={percent}>
                  <line
                    stroke="#E5E7EB"
                    strokeDasharray="4 4"
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="#6B7280"
                    fontSize={12}
                    textAnchor="end"
                    x={padding.left - 10}
                    y={y + 4}
                  >
                    {Math.round(value / 1000)}k
                  </text>
                </g>
              );
            })}

            {/* X axis labels */}
            {allMonths.map((month, i) => (
              <text
                key={month}
                fill="#6B7280"
                fontSize={12}
                textAnchor="middle"
                x={xScale(i)}
                y={chartHeight - 10}
              >
                {month}
              </text>
            ))}

            {/* Lines */}
            {selectedTrends.map((trend, trendIndex) => (
              <g key={trend.id}>
                {/* Line path */}
                <path
                  d={generatePath(trend.historicalData)}
                  fill="none"
                  stroke={getColor(trendIndex)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                />
                {/* Data points */}
                {trend.historicalData.map((point, i) => (
                  <circle
                    key={`${trend.id}-${point.month}`}
                    className="hover:r-6 cursor-pointer"
                    cx={xScale(i)}
                    cy={yScale(point.value)}
                    fill="white"
                    r={4}
                    stroke={getColor(trendIndex)}
                    strokeWidth={2}
                    onMouseEnter={() => {
                      setHoveredPoint({
                        skillId: trend.id,
                        month: point.month,
                        value: point.value,
                        x: xScale(i),
                        y: yScale(point.value),
                      });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </g>
            ))}

            {/* Tooltip */}
            {hoveredPoint && (
              <g>
                <rect
                  fill="white"
                  height={35}
                  rx={4}
                  stroke="#E5E7EB"
                  width={80}
                  x={hoveredPoint.x - 40}
                  y={hoveredPoint.y - 45}
                />
                <text
                  fill="#6B7280"
                  fontSize={11}
                  textAnchor="middle"
                  x={hoveredPoint.x}
                  y={hoveredPoint.y - 30}
                >
                  {hoveredPoint.month}
                </text>
                <text
                  fill="#111827"
                  fontSize={12}
                  fontWeight={600}
                  textAnchor="middle"
                  x={hoveredPoint.x}
                  y={hoveredPoint.y - 15}
                >
                  {hoveredPoint.value.toLocaleString()} jobs
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend / Skill Selector */}
        <div className="w-48 space-y-2">
          <p className="mb-3 text-xs font-medium text-gray-500">SELECT SKILLS TO COMPARE</p>
          {trends.map((trend, index) => (
            <button
              key={trend.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedSkills.has(trend.id)
                  ? 'bg-gray-100 font-medium'
                  : 'text-gray-500 hover:bg-gray-50'
              )}
              onClick={() => toggleSkill(trend.id)}
            >
              <div
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: selectedSkills.has(trend.id) ? getColor(index) : '#D1D5DB',
                }}
              />
              <span className="truncate">{trend.name}</span>
              {trend.growth > 0 && (
                <TrendingUp className="ml-auto h-3 w-3 flex-shrink-0 text-green-500" />
              )}
              {trend.growth < 0 && (
                <TrendingDown className="ml-auto h-3 w-3 flex-shrink-0 text-red-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-blue-500" />
          <div className="text-sm text-gray-600">
            <p className="mb-1 font-medium text-gray-900">Key Insight</p>
            <p>
              {selectedTrends.length > 0
                ? `${[...selectedTrends].sort((a, b) => b.growth - a.growth)[0]?.name ?? 'Unknown'} shows the strongest growth trajectory with ${[...selectedTrends].sort((a, b) => b.growth - a.growth)[0]?.growth ?? 0}% increase. Consider prioritizing skills with sustained upward trends.`
                : 'Select skills above to compare their demand trends over time.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrendChart;
