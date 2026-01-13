'use client';

/**
 * Executive Profile Detail Page
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Briefcase,
  Check,
  Calendar,
  MessageSquare,
  Star,
  Shield,
  Linkedin,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
  Input,
} from '@skillancer/ui';

// Mock executive data
const executive = {
  id: '1',
  slug: 'sarah-chen-abc12345',
  name: 'Sarah Chen',
  headline: 'Former VP Engineering at Stripe | Scaling teams 10→200',
  bio: 'I help startups build world-class engineering teams and scalable platforms. With 18 years of experience including 6 years at Stripe, I specialize in helping Series A-C companies navigate the challenges of rapid growth.',
  executiveType: 'FRACTIONAL_CTO',
  experience: { executive: 8, total: 18 },
  industries: ['Fintech', 'SaaS', 'Payments', 'B2B'],
  specializations: [
    'Team Scaling',
    'Platform Architecture',
    'Engineering Culture',
    'Technical Due Diligence',
    'DevOps',
  ],
  companyStages: ['SEED', 'SERIES_A', 'SERIES_B', 'SERIES_C'],
  timezone: 'America/Los_Angeles (PST)',
  availability: 'available',
  engagement: {
    hoursRange: { min: 15, max: 25 },
    hourlyRate: { min: 350, max: 450 },
    monthlyRetainer: { min: 15000, max: 25000 },
  },
  verification: { linkedinVerified: true, vetted: true },
  isFeatured: true,
  history: [
    {
      title: 'VP Engineering',
      company: 'Stripe',
      period: '2018-2024',
      achievements: ['Scaled team from 50 to 200 engineers', 'Led platform reliability initiative'],
    },
    {
      title: 'Engineering Director',
      company: 'Square',
      period: '2014-2018',
      achievements: ['Built payments infrastructure team'],
    },
  ],
};

export default function ExecutiveDetailPage() {
  const [showContactDialog, setShowContactDialog] = useState(false);
  const typeLabel = executive.executiveType.replace('FRACTIONAL_', '');

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/executives">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Executives
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl font-bold text-white">
                  {executive.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold">{executive.name}</h1>
                    {executive.isFeatured && (
                      <Badge className="bg-amber-100 text-amber-800">
                        <Star className="mr-1 h-3 w-3" />
                        Featured
                      </Badge>
                    )}
                    {executive.verification.vetted && (
                      <Badge className="bg-green-100 text-green-800">
                        <Shield className="mr-1 h-3 w-3" />
                        Vetted
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {typeLabel}
                  </Badge>
                  <p className="mt-3 text-gray-600">{executive.headline}</p>
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {executive.experience.executive}y executive exp
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {executive.timezone}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-gray-700">{executive.bio}</p>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader>
              <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {executive.history.map((h, i) => (
                <div key={i} className="border-l-2 border-purple-200 pl-4">
                  <div className="font-medium">{h.title}</div>
                  <div className="text-sm text-gray-500">
                    {h.company} • {h.period}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {h.achievements.map((a, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-green-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Badge className="w-full justify-center bg-green-100 py-2 text-green-800">
                Available Now
              </Badge>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Hours/Week</span>
                  <span className="font-medium">
                    {executive.engagement.hoursRange.min}-{executive.engagement.hoursRange.max}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hourly Rate</span>
                  <span className="font-medium">
                    ${executive.engagement.hourlyRate.min}-${executive.engagement.hourlyRate.max}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Retainer</span>
                  <span className="font-medium">
                    ${(executive.engagement.monthlyRetainer.min / 1000).toFixed(0)}k-$
                    {(executive.engagement.monthlyRetainer.max / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={() => setShowContactDialog(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Request Introduction
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/executives/request?exec=${executive.id}`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Call
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expertise</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {executive.specializations.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Industries</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {executive.industries.map((i) => (
                <Badge key={i} variant="outline">
                  {i}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Introduction to {executive.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Your name" />
            <Input placeholder="Your email" type="email" />
            <Input placeholder="Company" />
            <Textarea
              placeholder="Tell us about your needs and why you'd like to connect..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowContactDialog(false)}>Send Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
