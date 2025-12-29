'use client';

import { useState } from 'react';

type ResolutionType = 'full_refund' | 'full_payment' | 'partial' | 'dismiss';

interface ResolutionFormProps {
  disputeId: string;
  amount: number;
  clientName: string;
  freelancerName: string;
  onSubmit: (data: ResolutionData) => void;
  compact?: boolean;
}

interface ResolutionData {
  type: ResolutionType;
  clientAmount: number;
  freelancerAmount: number;
  reasoning: string;
  evidenceCited: string[];
  notifyParties: boolean;
  appealPeriodDays: number;
}

const evidenceOptions = [
  'Original contract terms',
  'Chat history',
  'Delivered work screenshots',
  'Requirements document',
  'SkillPod recording',
  'Payment history',
];

export function ResolutionForm({
  amount,
  clientName,
  freelancerName,
  onSubmit,
  compact = false,
}: ResolutionFormProps) {
  const [resolutionType, setResolutionType] = useState<ResolutionType>('partial');
  const [clientAmount, setClientAmount] = useState(0);
  const [freelancerAmount, setFreelancerAmount] = useState(amount);
  const [reasoning, setReasoning] = useState('');
  const [evidenceCited, setEvidenceCited] = useState<string[]>([]);
  const [notifyParties, setNotifyParties] = useState(true);
  const [appealPeriodDays, setAppealPeriodDays] = useState(7);

  const handleTypeChange = (type: ResolutionType) => {
    setResolutionType(type);
    switch (type) {
      case 'full_refund':
        setClientAmount(amount);
        setFreelancerAmount(0);
        break;
      case 'full_payment':
        setClientAmount(0);
        setFreelancerAmount(amount);
        break;
      case 'partial':
        setClientAmount(amount / 2);
        setFreelancerAmount(amount / 2);
        break;
      case 'dismiss':
        setClientAmount(0);
        setFreelancerAmount(0);
        break;
    }
  };

  const handleSliderChange = (value: number) => {
    setClientAmount(value);
    setFreelancerAmount(amount - value);
  };

  const toggleEvidence = (evidence: string) => {
    setEvidenceCited((prev) =>
      prev.includes(evidence) ? prev.filter((e) => e !== evidence) : [...prev, evidence]
    );
  };

  const handleSubmit = () => {
    if (!reasoning.trim()) {
      alert('Please provide reasoning for the resolution');
      return;
    }
    onSubmit({
      type: resolutionType,
      clientAmount,
      freelancerAmount,
      reasoning,
      evidenceCited,
      notifyParties,
      appealPeriodDays,
    });
  };

  return (
    <div className={`space-y-${compact ? '4' : '6'}`}>
      {!compact && <h3 className="text-lg font-medium text-gray-900">Resolution Decision</h3>}

      {/* Resolution Type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Resolution Type</label>
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-2`}>
          {[
            { key: 'full_refund', label: 'Full Refund', desc: `100% to ${clientName}` },
            { key: 'full_payment', label: 'Full Payment', desc: `100% to ${freelancerName}` },
            { key: 'partial', label: 'Split', desc: 'Divide amount' },
            { key: 'dismiss', label: 'Dismiss', desc: 'No action' },
          ].map((option) => (
            <button
              key={option.key}
              className={`rounded-lg border p-3 text-left transition-colors ${
                resolutionType === option.key
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTypeChange(option.key as ResolutionType)}
            >
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-500">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Allocation (for partial) */}
      {resolutionType === 'partial' && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Amount Allocation</label>
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="mb-4 flex justify-between text-sm">
              <div>
                <span className="text-gray-600">{clientName}:</span>{' '}
                <span className="font-bold text-blue-600">${clientAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">{freelancerName}:</span>{' '}
                <span className="font-bold text-green-600">${freelancerAmount.toFixed(2)}</span>
              </div>
            </div>
            <input
              className="w-full"
              max={amount}
              min={0}
              step={1}
              type="range"
              value={clientAmount}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
            />
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>50/50</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Reasoning <span className="text-red-500">*</span>
        </label>
        <textarea
          className={`w-full rounded-lg border p-3 text-sm ${compact ? 'h-24' : 'h-32'}`}
          placeholder="Explain the reasoning behind this decision..."
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
        />
      </div>

      {/* Evidence Cited */}
      {!compact && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Evidence Cited</label>
          <div className="flex flex-wrap gap-2">
            {evidenceOptions.map((evidence) => (
              <button
                key={evidence}
                className={`rounded-full px-3 py-1 text-sm ${
                  evidenceCited.includes(evidence)
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => toggleEvidence(evidence)}
              >
                {evidence}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options */}
      <div className={`flex ${compact ? 'flex-col gap-2' : 'items-center justify-between'}`}>
        <label className="flex items-center gap-2">
          <input
            checked={notifyParties}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            type="checkbox"
            onChange={(e) => setNotifyParties(e.target.checked)}
          />
          <span className="text-sm text-gray-700">Notify both parties of decision</span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Appeal period:</label>
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={appealPeriodDays}
            onChange={(e) => setAppealPeriodDays(Number(e.target.value))}
          >
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={0}>No appeal</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-yellow-50 p-4">
        <h4 className="font-medium text-yellow-900">Resolution Summary</h4>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
          <li>
            • {clientName} receives: ${clientAmount.toFixed(2)}
          </li>
          <li>
            • {freelancerName} receives: ${freelancerAmount.toFixed(2)}
          </li>
          <li>• Appeal period: {appealPeriodDays} days</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Save Draft
        </button>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={handleSubmit}
        >
          Record Decision
        </button>
      </div>
    </div>
  );
}
