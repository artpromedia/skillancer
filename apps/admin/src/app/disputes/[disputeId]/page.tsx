'use client';

import { useState } from 'react';

import { ResolutionForm } from '@/components/disputes/resolution-form';

interface DisputeDetail {
  id: string;
  contractId: string;
  contractTitle: string;
  type: string;
  status: string;
  amount: number;
  priority: string;
  client: { id: string; name: string; email: string; totalContracts: number; disputeRate: number };
  freelancer: {
    id: string;
    name: string;
    email: string;
    totalContracts: number;
    disputeRate: number;
  };
  assignedTo?: { id: string; name: string };
  createdAt: string;
  description: string;
  timeline: { event: string; by: string; at: string; details?: string }[];
  evidence: { type: string; name: string; uploadedBy: string; uploadedAt: string }[];
  messages: { from: string; content: string; at: string }[];
}

const mockDispute: DisputeDetail = {
  id: 'd1',
  contractId: 'c1',
  contractTitle: 'E-commerce Website Development',
  type: 'payment',
  status: 'in_progress',
  amount: 5000,
  priority: 'high',
  client: {
    id: 'u1',
    name: 'TechCorp Inc.',
    email: 'contact@techcorp.com',
    totalContracts: 45,
    disputeRate: 0.02,
  },
  freelancer: {
    id: 'u2',
    name: 'Alex Developer',
    email: 'alex@example.com',
    totalContracts: 120,
    disputeRate: 0.01,
  },
  assignedTo: { id: 'a1', name: 'Admin John' },
  createdAt: '2024-01-14T10:00:00Z',
  description:
    'Client claims the work was not completed as specified. Freelancer claims all milestones were delivered and approved.',
  timeline: [
    { event: 'Contract started', by: 'System', at: '2023-12-01T10:00:00Z' },
    { event: 'Milestone 1 completed', by: 'Freelancer', at: '2023-12-15T14:00:00Z' },
    { event: 'Milestone 1 approved', by: 'Client', at: '2023-12-16T09:00:00Z' },
    { event: 'Milestone 2 completed', by: 'Freelancer', at: '2024-01-05T16:00:00Z' },
    {
      event: 'Dispute filed',
      by: 'Client',
      at: '2024-01-14T10:00:00Z',
      details: 'Milestone 2 does not meet specifications',
    },
    {
      event: 'Dispute assigned',
      by: 'System',
      at: '2024-01-14T10:05:00Z',
      details: 'Assigned to Admin John',
    },
  ],
  evidence: [
    {
      type: 'document',
      name: 'Original Requirements.pdf',
      uploadedBy: 'Client',
      uploadedAt: '2024-01-14T10:30:00Z',
    },
    {
      type: 'screenshot',
      name: 'Delivered Work Screenshot.png',
      uploadedBy: 'Freelancer',
      uploadedAt: '2024-01-14T11:00:00Z',
    },
    {
      type: 'document',
      name: 'Chat History Export.pdf',
      uploadedBy: 'Freelancer',
      uploadedAt: '2024-01-14T11:15:00Z',
    },
  ],
  messages: [
    {
      from: 'Client',
      content: 'The delivered work is missing key features we discussed.',
      at: '2024-01-14T10:20:00Z',
    },
    {
      from: 'Freelancer',
      content:
        'All features in the original requirements were delivered. The additional features were never agreed upon.',
      at: '2024-01-14T11:30:00Z',
    },
    {
      from: 'Admin John',
      content: "I've reviewed the evidence. Can both parties confirm the original scope document?",
      at: '2024-01-14T14:00:00Z',
    },
  ],
};

export default function DisputeDetailPage({ params }: { params: { disputeId: string } }) {
  const [dispute] = useState<DisputeDetail>(mockDispute);
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'messages' | 'resolution'>(
    'overview'
  );
  const [showResolution, setShowResolution] = useState(false);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      escalated: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Dispute #{params.disputeId}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(dispute.status)}`}
            >
              {dispute.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-gray-600">{dispute.contractTitle}</p>
        </div>
        <div className="flex gap-2">
          {!showResolution && (
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              onClick={() => setShowResolution(true)}
            >
              Resolve Dispute
            </button>
          )}
        </div>
      </div>

      {/* Amount at Stake */}
      <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-amber-800">Amount in Dispute</div>
            <div className="text-3xl font-bold text-amber-900">
              ${dispute.amount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-amber-800">Contract Value</div>
            <div className="text-lg font-medium text-amber-900">$8,000</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-4">
              {(['overview', 'evidence', 'messages', 'resolution'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Description */}
              <div className="rounded-lg border bg-white p-4">
                <h3 className="mb-2 font-medium text-gray-900">Dispute Summary</h3>
                <p className="text-gray-700">{dispute.description}</p>
              </div>

              {/* Timeline */}
              <div className="rounded-lg border bg-white p-4">
                <h3 className="mb-4 font-medium text-gray-900">Timeline</h3>
                <div className="space-y-4">
                  {dispute.timeline.map((event, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-indigo-600" />
                        {i < dispute.timeline.length - 1 && (
                          <div className="h-full w-0.5 bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{event.event}</p>
                          <span className="text-xs text-gray-500">
                            {new Date(event.at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">by {event.by}</p>
                        {event.details && (
                          <p className="mt-1 text-sm text-gray-600">{event.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-4 font-medium text-gray-900">Submitted Evidence</h3>
              <div className="space-y-3">
                {dispute.evidence.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="h-8 w-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Uploaded by {item.uploadedBy} on{' '}
                          {new Date(item.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-4 font-medium text-gray-900">Dispute Messages</h3>
              <div className="space-y-4">
                {dispute.messages.map((msg, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{msg.from}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-700">{msg.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <textarea
                  className="h-24 w-full rounded-lg border p-3 text-sm"
                  placeholder="Add a message..."
                />
                <button className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Send Message
                </button>
              </div>
            </div>
          )}

          {activeTab === 'resolution' && (
            <ResolutionForm
              amount={dispute.amount}
              clientName={dispute.client.name}
              disputeId={dispute.id}
              freelancerName={dispute.freelancer.name}
              onSubmit={(data) => console.log('Resolution:', data)}
            />
          )}

          {/* Resolution Panel (modal-like) */}
          {showResolution && activeTab !== 'resolution' && (
            <div className="rounded-lg border-2 border-indigo-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Quick Resolution</h3>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setShowResolution(false)}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </button>
              </div>
              <ResolutionForm
                compact
                amount={dispute.amount}
                clientName={dispute.client.name}
                disputeId={dispute.id}
                freelancerName={dispute.freelancer.name}
                onSubmit={(data) => {
                  console.log('Resolution:', data);
                  setShowResolution(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Parties */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Parties Involved</h3>

            {/* Client */}
            <div className="mb-4 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-700">
                  {dispute.client.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{dispute.client.name}</p>
                  <p className="text-xs text-gray-500">Client</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Contracts</dt>
                  <dd className="font-medium text-gray-900">{dispute.client.totalContracts}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Dispute Rate</dt>
                  <dd className="font-medium text-gray-900">
                    {(dispute.client.disputeRate * 100).toFixed(1)}%
                  </dd>
                </div>
              </dl>
              <button className="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Profile
              </button>
            </div>

            {/* Freelancer */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-medium text-green-700">
                  {dispute.freelancer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{dispute.freelancer.name}</p>
                  <p className="text-xs text-gray-500">Freelancer</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Contracts</dt>
                  <dd className="font-medium text-gray-900">{dispute.freelancer.totalContracts}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Dispute Rate</dt>
                  <dd className="font-medium text-gray-900">
                    {(dispute.freelancer.disputeRate * 100).toFixed(1)}%
                  </dd>
                </div>
              </dl>
              <button className="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Profile
              </button>
            </div>
          </div>

          {/* Assigned To */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Assigned Mediator</h3>
            {dispute.assignedTo ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                  {dispute.assignedTo.name.charAt(0)}
                </div>
                <span className="font-medium text-gray-900">{dispute.assignedTo.name}</span>
              </div>
            ) : (
              <button className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Assign to Me
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Contract Details
              </button>
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                View SkillPod Recording
              </button>
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50">
                Escalate to Senior Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
