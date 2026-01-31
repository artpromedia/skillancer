'use client';

import { use } from 'react';

import { ContractDetailClient } from './contract-detail-client';

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = use(params);
  return <ContractDetailClient contractId={contractId} />;
}
