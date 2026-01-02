'use client';

import { cn } from '@skillancer/ui';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  DollarSign,
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useMemo } from 'react';

type HealthStatus = 'good' | 'warning' | 'poor';

interface ClientHealthScoreProps {
  readonly clientId: string;
  // Metrics
  readonly totalRevenue: number;
  readonly projectCount: number;
  readonly averageRating?: number;
  readonly responseTime?: number; // in hours
  readonly lastContactDays: number;
  readonly paymentScore: number; // 0-100, based on on-time payments
  readonly repeatRate: number; // percentage of repeat projects
  readonly referralCount: number;
  // Optional display options
  readonly variant?: 'compact' | 'full';
  readonly className?: string;
}

interface HealthMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number; // 0-100
  readonly weight: number;
  readonly icon: React.ReactNode;
  readonly description: string;
  readonly status: HealthStatus;
}

// Helper functions to simplify nested ternary operations
function getContactScore(days: number): number {
  if (days <= 7) return 100;
  if (days <= 30) return 70;
  if (days <= 90) return 40;
  return 10;
}

function getResponseTimeScore(hours: number): number {
  if (hours <= 4) return 100;
  if (hours <= 12) return 80;
  if (hours <= 24) return 60;
  if (hours <= 48) return 40;
  return 20;
}

function getStatusFromScore(
  score: number,
  goodThreshold: number,
  warningThreshold: number
): HealthStatus {
  if (score >= goodThreshold) return 'good';
  if (score >= warningThreshold) return 'warning';
  return 'poor';
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function getTrendLabel(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return 'Improving';
  if (trend === 'down') return 'Declining';
  return 'Stable';
}

function getStatusTextColor(status: HealthStatus): string {
  if (status === 'good') return 'text-green-600';
  if (status === 'warning') return 'text-amber-600';
  return 'text-red-600';
}

function getStatusBgColor(status: HealthStatus): string {
  if (status === 'good') return 'bg-green-500';
  if (status === 'warning') return 'bg-amber-500';
  return 'bg-red-500';
}

export function ClientHealthScore({
  // clientId and projectCount are part of the interface but not used in this component
  totalRevenue,
  averageRating = 0,
  responseTime = 24,
  lastContactDays,
  paymentScore,
  repeatRate,
  referralCount,
  variant = 'full',
  className,
}: ClientHealthScoreProps) {
  // Calculate individual metrics
  const metrics: HealthMetric[] = useMemo(() => {
    // Revenue score (based on lifetime value)
    const revenueScore = Math.min(100, (totalRevenue / 10000) * 100);

    // Engagement score (based on last contact)
    const engagementScore = getContactScore(lastContactDays);

    // Response score (based on response time)
    const responseScore = getResponseTimeScore(responseTime);

    // Rating score
    const ratingScore = averageRating ? averageRating * 20 : 50;

    // Loyalty score (repeat rate + referrals)
    const loyaltyScore = Math.min(100, repeatRate + referralCount * 10);

    return [
      {
        id: 'revenue',
        label: 'Revenue',
        value: revenueScore,
        weight: 0.25,
        icon: <DollarSign className="h-4 w-4" />,
        description: `$${totalRevenue.toLocaleString()} lifetime value`,
        status: getStatusFromScore(revenueScore, 70, 40),
      },
      {
        id: 'engagement',
        label: 'Engagement',
        value: engagementScore,
        weight: 0.2,
        icon: <MessageSquare className="h-4 w-4" />,
        description: `Last contact ${lastContactDays} days ago`,
        status: getStatusFromScore(engagementScore, 70, 40),
      },
      {
        id: 'payment',
        label: 'Payment',
        value: paymentScore,
        weight: 0.2,
        icon: <Clock className="h-4 w-4" />,
        description: `${paymentScore}% on-time payments`,
        status: getStatusFromScore(paymentScore, 80, 60),
      },
      {
        id: 'loyalty',
        label: 'Loyalty',
        value: loyaltyScore,
        weight: 0.15,
        icon: <Heart className="h-4 w-4" />,
        description: `${repeatRate}% repeat, ${referralCount} referrals`,
        status: getStatusFromScore(loyaltyScore, 60, 30),
      },
      {
        id: 'rating',
        label: 'Satisfaction',
        value: ratingScore,
        weight: 0.1,
        icon: <Star className="h-4 w-4" />,
        description: averageRating ? `${averageRating.toFixed(1)} avg rating` : 'No ratings yet',
        status: getStatusFromScore(ratingScore, 80, 60),
      },
      {
        id: 'response',
        label: 'Responsiveness',
        value: responseScore,
        weight: 0.1,
        icon: <Clock className="h-4 w-4" />,
        description: `${responseTime}h avg response`,
        status: getStatusFromScore(responseScore, 70, 40),
      },
    ];
  }, [
    totalRevenue,
    averageRating,
    responseTime,
    lastContactDays,
    paymentScore,
    repeatRate,
    referralCount,
  ]);

  // Calculate overall health score
  const overallScore = useMemo(() => {
    return Math.round(metrics.reduce((sum, metric) => sum + metric.value * metric.weight, 0));
  }, [metrics]);

  // Determine trend (mock - would come from historical data)
  const trend = useMemo(() => {
    // Mock trend calculation
    if (overallScore >= 75) return 'up';
    if (overallScore <= 40) return 'down';
    return 'stable';
  }, [overallScore]);

  // Get health status
  const healthStatus = useMemo(() => {
    if (overallScore >= 80)
      return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-500' };
    if (overallScore >= 60) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-500' };
    if (overallScore >= 40) return { label: 'Fair', color: 'text-amber-600', bg: 'bg-amber-500' };
    return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-500' };
  }, [overallScore]);

  // Recommendations based on low scores
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    metrics.forEach((metric) => {
      if (metric.status === 'poor') {
        switch (metric.id) {
          case 'engagement':
            recs.push('Schedule a check-in call or send a follow-up email');
            break;
          case 'payment':
            recs.push('Review payment terms and consider milestone-based billing');
            break;
          case 'loyalty':
            recs.push('Send a thank-you note and offer a referral incentive');
            break;
          case 'revenue':
            recs.push('Propose additional services or upsell opportunities');
            break;
        }
      }
    });
    return recs;
  }, [metrics]);

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative h-10 w-10">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" fill="none" r="16" stroke="#E5E7EB" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              fill="none"
              r="16"
              stroke={getScoreColor(overallScore)}
              strokeDasharray={`${overallScore} 100`}
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900">{overallScore}</span>
          </div>
        </div>
        <div>
          <div className={cn('text-sm font-medium', healthStatus.color)}>{healthStatus.label}</div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
            {trend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
            <span>{getTrendLabel(trend)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <Heart className="h-5 w-5 text-pink-500" />
            Client Health Score
          </h3>
          <div className="flex items-center gap-2">
            {trend === 'up' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-4 w-4" />
                Improving
              </span>
            )}
            {trend === 'down' && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <TrendingDown className="h-4 w-4" />
                Declining
              </span>
            )}
            {trend === 'stable' && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Minus className="h-4 w-4" />
                Stable
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score Circle */}
      <div className="p-6">
        <div className="flex items-center gap-6">
          <div className="relative h-28 w-28 flex-shrink-0">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="none" r="45" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                className={cn('transition-all duration-1000', healthStatus.bg)}
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeDasharray={`${overallScore * 2.83} 283`}
                strokeLinecap="round"
                strokeWidth="8"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{overallScore}</span>
              <span className="text-xs text-gray-500">/ 100</span>
            </div>
          </div>

          <div className="flex-1">
            <div className={cn('mb-1 text-lg font-semibold', healthStatus.color)}>
              {healthStatus.label}
            </div>
            <p className="mb-3 text-sm text-gray-500">
              Based on {metrics.length} relationship factors
            </p>
            {recommendations.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{recommendations[0]}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Breakdown */}
      <div className="space-y-3 px-4 pb-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                {metric.icon}
                <span>{metric.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{metric.description}</span>
                <span className={cn('font-medium', getStatusTextColor(metric.status))}>
                  {metric.value}
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  getStatusBgColor(metric.status)
                )}
                style={{ width: `${metric.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {recommendations.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-4 w-4" />
            <span className="font-medium">Recommendations</span>
          </div>
          <ul className="space-y-1">
            {recommendations.map((rec) => (
              <li
                key={`recommendation-${rec}`}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ClientHealthScore;
