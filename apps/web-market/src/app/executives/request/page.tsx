'use client';

/**
 * Executive Matching Request Form
 * Clients submit requirements to get matched with executives
 */

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import { ArrowLeft, Users, Briefcase, Clock, DollarSign, Send, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const executiveTypes = [
  { value: 'FRACTIONAL_CTO', label: 'Chief Technology Officer (CTO)' },
  { value: 'FRACTIONAL_CFO', label: 'Chief Financial Officer (CFO)' },
  { value: 'FRACTIONAL_CMO', label: 'Chief Marketing Officer (CMO)' },
  { value: 'FRACTIONAL_COO', label: 'Chief Operating Officer (COO)' },
  { value: 'FRACTIONAL_CPO', label: 'Chief Product Officer (CPO)' },
  { value: 'FRACTIONAL_CHRO', label: 'Chief HR Officer (CHRO)' },
  { value: 'FRACTIONAL_CISO', label: 'Chief Information Security Officer (CISO)' },
];

const companyStages = [
  { value: 'PRE_SEED', label: 'Pre-Seed' },
  { value: 'SEED', label: 'Seed' },
  { value: 'SERIES_A', label: 'Series A' },
  { value: 'SERIES_B', label: 'Series B' },
  { value: 'SERIES_C', label: 'Series C+' },
  { value: 'GROWTH', label: 'Growth Stage' },
  { value: 'PUBLIC', label: 'Public Company' },
];

const timelines = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '2_weeks', label: 'Within 2 weeks' },
  { value: '1_month', label: 'Within 1 month' },
  { value: 'flexible', label: 'Flexible' },
];

export default function MatchRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    title: '',
    executiveType: '',
    companyStage: '',
    industry: '',
    hoursPerWeek: '',
    budgetMin: '',
    budgetMax: '',
    timeline: '',
    needs: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // API call would go here
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="mb-4 text-2xl font-bold">Request Submitted!</h1>
        <p className="mb-6 text-gray-600">
          Our team will review your requirements and send you curated executive matches within 24-48
          hours.
        </p>
        <Button asChild>
          <Link href="/executives">Browse Executives</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button asChild className="mb-6" size="sm" variant="ghost">
        <Link href="/executives">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Link>
      </Button>

      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">Get Matched with an Executive</h1>
        <p className="text-gray-600">Tell us about your needs and we'll find the perfect match.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Full Name *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Company *</Label>
              <Input
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div>
              <Label>Your Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Executive Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Executive Type *</Label>
              <Select
                required
                value={formData.executiveType}
                onValueChange={(v) => setFormData({ ...formData, executiveType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {executiveTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company Stage</Label>
                <Select
                  value={formData.companyStage}
                  onValueChange={(v) => setFormData({ ...formData, companyStage: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyStages.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Industry</Label>
                <Input
                  placeholder="e.g., Fintech, SaaS"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Engagement Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hours per Week *</Label>
                <Input
                  required
                  placeholder="e.g., 15"
                  type="number"
                  value={formData.hoursPerWeek}
                  onChange={(e) => setFormData({ ...formData, hoursPerWeek: e.target.value })}
                />
              </div>
              <div>
                <Label>Timeline</Label>
                <Select
                  value={formData.timeline}
                  onValueChange={(v) => setFormData({ ...formData, timeline: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="When to start" />
                  </SelectTrigger>
                  <SelectContent>
                    {timelines.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Budget Min ($/hr)</Label>
                <Input
                  placeholder="e.g., 300"
                  type="number"
                  value={formData.budgetMin}
                  onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                />
              </div>
              <div>
                <Label>Budget Max ($/hr)</Label>
                <Input
                  placeholder="e.g., 500"
                  type="number"
                  value={formData.budgetMax}
                  onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Specific Needs & Challenges</Label>
              <Textarea
                placeholder="Describe what you're looking for help with..."
                rows={4}
                value={formData.needs}
                onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" type="submit">
          <Send className="mr-2 h-4 w-4" />
          Submit Match Request
        </Button>
      </form>
    </div>
  );
}
