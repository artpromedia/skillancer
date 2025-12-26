/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * Pod Details Component
 *
 * Displays comprehensive pod information:
 * - Pod configuration
 * - Resource allocation
 * - Containment settings
 * - Usage statistics
 */

import { cn } from '@skillancer/ui/lib/utils';
import {
  Clock,
  Cpu,
  HardDrive,
  Info,
  Lock,
  MemoryStick,
  Package,
  Shield,
  Tag,
  User,
} from 'lucide-react';

import type { PodDetails as PodDetailsType } from '@/lib/api/pods';

// ============================================================================
// TYPES
// ============================================================================

export interface PodDetailsProps {
  pod: PodDetailsType;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PodDetails({ pod }: PodDetailsProps) {
  const containmentColors = {
    standard: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    high: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    maximum: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const containmentLabels = {
    standard: 'Standard Security',
    high: 'High Security',
    maximum: 'Maximum Containment',
  };

  return (
    <div className="space-y-6">
      {/* Containment Level Banner */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-4',
          containmentColors[pod.containmentLevel]
        )}
      >
        <Shield className="h-6 w-6" />
        <div>
          <p className="font-semibold">{containmentLabels[pod.containmentLevel]}</p>
          <p className="text-sm opacity-80">
            {pod.containmentLevel === 'standard' && 'Basic data protection with monitored access'}
            {pod.containmentLevel === 'high' && 'Enhanced security with restricted file transfer'}
            {pod.containmentLevel === 'maximum' && 'Full isolation with watermarked display'}
          </p>
        </div>
      </div>

      {/* Pod Configuration */}
      <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Package className="h-5 w-5" />
          Configuration
        </h3>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-gray-400">
              <Info className="h-4 w-4" />
              Image
            </dt>
            <dd className="mt-1 font-mono text-white">{pod.image}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-gray-400">
              <Tag className="h-4 w-4" />
              Version
            </dt>
            <dd className="mt-1 font-mono text-white">{pod.imageVersion}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-gray-400">
              <User className="h-4 w-4" />
              Owner
            </dt>
            <dd className="mt-1 text-white">{pod.ownerName}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-gray-400">
              <Clock className="h-4 w-4" />
              Created
            </dt>
            <dd className="mt-1 text-white">{new Date(pod.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Resource Allocation */}
      <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Cpu className="h-5 w-5" />
          Resources
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-700/50 p-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Cpu className="h-4 w-4" />
              <span className="text-sm">CPU</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{pod.resources.cpu}</p>
            <p className="text-sm text-gray-500">vCPU cores</p>
          </div>

          <div className="rounded-lg bg-gray-700/50 p-4">
            <div className="flex items-center gap-2 text-gray-400">
              <MemoryStick className="h-4 w-4" />
              <span className="text-sm">Memory</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{pod.resources.memory}</p>
            <p className="text-sm text-gray-500">GB RAM</p>
          </div>

          <div className="rounded-lg bg-gray-700/50 p-4">
            <div className="flex items-center gap-2 text-gray-400">
              <HardDrive className="h-4 w-4" />
              <span className="text-sm">Storage</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{pod.resources.storage}</p>
            <p className="text-sm text-gray-500">GB SSD</p>
          </div>
        </div>
      </div>

      {/* Security Features */}
      <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Lock className="h-5 w-5" />
          Security Features
        </h3>

        <ul className="space-y-3">
          <SecurityFeature
            description="All data encrypted in transit and at rest"
            enabled={true}
            label="End-to-end encryption"
          />
          <SecurityFeature
            description="DLP scanning for sensitive data"
            enabled={pod.containmentLevel !== 'standard'}
            label="Clipboard monitoring"
          />
          <SecurityFeature
            description="Dynamic watermarks and capture blocking"
            enabled={pod.containmentLevel === 'maximum'}
            label="Screenshot protection"
          />
          <SecurityFeature
            description="Malware and DLP scanning for all transfers"
            enabled={pod.containmentLevel !== 'standard'}
            label="File transfer scanning"
          />
          <SecurityFeature
            description="Complete audit trail of all activity"
            enabled={true}
            label="Session recording"
          />
          <SecurityFeature
            description="External device access restricted"
            enabled={pod.containmentLevel === 'maximum'}
            label="USB device blocking"
          />
        </ul>
      </div>

      {/* Tags */}
      {pod.tags && pod.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pod.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECURITY FEATURE
// ============================================================================

interface SecurityFeatureProps {
  enabled: boolean;
  label: string;
  description: string;
}

function SecurityFeature({ enabled, label, description }: SecurityFeatureProps) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full',
          enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/50 text-gray-500'
        )}
      >
        {enabled ? '✓' : '○'}
      </div>
      <div>
        <p className={cn('font-medium', enabled ? 'text-white' : 'text-gray-500')}>{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </li>
  );
}
