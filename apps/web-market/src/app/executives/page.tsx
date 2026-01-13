'use client';

/**
 * Executive Discovery Marketplace
 * Browse and search for fractional executives
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import { Search, Filter, Users, Briefcase, Clock, MapPin, Star, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Types
interface Executive {
  id: string;
  slug: string;
  name: string;
  headline: string;
  executiveType: string;
  yearsExp: number;
  industries: string[];
  specializations: string[];
  availability: 'available' | 'limited' | 'unavailable';
  timezone: string;
  hoursRange: string | null;
  rateRange: { min: number; max: number } | null;
  photoUrl: string | null;
  isFeatured: boolean;
}

// Mock data
const mockExecutives: Executive[] = [
  {
    id: '1',
    slug: 'sarah-chen-abc12345',
    name: 'Sarah Chen',
    headline: 'Former VP Engineering at Stripe | Scaling teams 10→200',
    executiveType: 'FRACTIONAL_CTO',
    yearsExp: 18,
    industries: ['Fintech', 'SaaS', 'Payments'],
    specializations: ['Team Scaling', 'Platform Architecture', 'Engineering Culture'],
    availability: 'available',
    timezone: 'America/Los_Angeles',
    hoursRange: '15-25 hrs/week',
    rateRange: { min: 350, max: 450 },
    photoUrl: null,
    isFeatured: true,
  },
  {
    id: '2',
    slug: 'michael-rodriguez-def67890',
    name: 'Michael Rodriguez',
    headline: 'CFO who helped 3 startups reach $100M ARR',
    executiveType: 'FRACTIONAL_CFO',
    yearsExp: 22,
    industries: ['SaaS', 'E-commerce', 'Healthcare'],
    specializations: ['Fundraising', 'Financial Planning', 'M&A'],
    availability: 'limited',
    timezone: 'America/New_York',
    hoursRange: '10-20 hrs/week',
    rateRange: { min: 400, max: 500 },
    photoUrl: null,
    isFeatured: true,
  },
  {
    id: '3',
    slug: 'jennifer-walsh-ghi11111',
    name: 'Jennifer Walsh',
    headline: 'CMO | Built marketing teams at 4 unicorns',
    executiveType: 'FRACTIONAL_CMO',
    yearsExp: 15,
    industries: ['Consumer', 'D2C', 'Marketplace'],
    specializations: ['Brand Strategy', 'Growth Marketing', 'Team Building'],
    availability: 'available',
    timezone: 'America/Chicago',
    hoursRange: '10-15 hrs/week',
    rateRange: { min: 300, max: 400 },
    photoUrl: null,
    isFeatured: false,
  },
];

const executiveTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'FRACTIONAL_CTO', label: 'CTO' },
  { value: 'FRACTIONAL_CFO', label: 'CFO' },
  { value: 'FRACTIONAL_CMO', label: 'CMO' },
  { value: 'FRACTIONAL_COO', label: 'COO' },
  { value: 'FRACTIONAL_CPO', label: 'CPO' },
  { value: 'FRACTIONAL_CHRO', label: 'CHRO' },
];

const availabilityLabels = {
  available: { label: 'Available Now', color: 'bg-green-100 text-green-800' },
  limited: { label: 'Limited', color: 'bg-amber-100 text-amber-800' },
  unavailable: { label: 'Unavailable', color: 'bg-gray-100 text-gray-600' },
};

function ExecutiveCard({ executive }: { executive: Executive }) {
  const typeLabel = executive.executiveType.replace('FRACTIONAL_', '');
  const avail = availabilityLabels[executive.availability];

  return (
    <Link href={`/executives/${executive.slug}`}>
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xl font-bold text-white">
              {executive.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{executive.name}</h3>
                {executive.isFeatured && (
                  <Badge className="bg-amber-100 text-amber-800">
                    <Star className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                )}
              </div>
              <Badge className="mt-1" variant="outline">
                {typeLabel}
              </Badge>
              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{executive.headline}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1">
            {executive.industries.slice(0, 3).map((ind) => (
              <Badge key={ind} className="text-xs" variant="secondary">
                {ind}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <div className="flex items-center gap-4 text-gray-500">
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {executive.yearsExp}y exp
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {executive.hoursRange || 'Flexible'}
              </span>
            </div>
            <Badge className={avail.color}>{avail.label}</Badge>
          </div>

          {executive.rateRange && (
            <div className="mt-3 text-sm text-gray-600">
              ${executive.rateRange.min}-${executive.rateRange.max}/hr
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ExecutivesPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const executives = mockExecutives;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-4 text-4xl font-bold">Find Your Fractional Executive</h1>
        <p className="mx-auto max-w-2xl text-xl text-gray-600">
          Access world-class executive talent on-demand. Browse our curated network of vetted
          executives.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Search by name, skill, or industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Executive Type" />
          </SelectTrigger>
          <SelectContent>
            {executiveTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          More Filters
        </Button>
      </div>

      {/* CTA Banner */}
      <Card className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-xl font-semibold">Not sure who you need?</h3>
            <p className="opacity-90">
              Let us match you with the perfect executive for your needs.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/executives/request">Get Matched</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {executives.map((exec) => (
          <ExecutiveCard key={exec.id} executive={exec} />
        ))}
      </div>
    </div>
  );
}
