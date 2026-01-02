'use client';

/**
 * Client Onboarding Wizard
 * 3-step onboarding for clients hiring executives
 */

import { Button } from '@skillancer/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@skillancer/ui/card';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Progress } from '@skillancer/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { Textarea } from '@skillancer/ui/textarea';
import { Building2, Target, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STEPS = ['Company', 'Needs', 'Complete'];

const COMPANY_STAGES = [
  { value: 'PRE_SEED', label: 'Pre-Seed' },
  { value: 'SEED', label: 'Seed' },
  { value: 'SERIES_A', label: 'Series A' },
  { value: 'SERIES_B', label: 'Series B' },
  { value: 'SERIES_C_PLUS', label: 'Series C+' },
  { value: 'GROWTH', label: 'Growth' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const EXECUTIVE_TYPES = [
  { value: 'FRACTIONAL_CTO', label: 'Fractional CTO' },
  { value: 'FRACTIONAL_CFO', label: 'Fractional CFO' },
  { value: 'FRACTIONAL_CMO', label: 'Fractional CMO' },
  { value: 'FRACTIONAL_COO', label: 'Fractional COO' },
  { value: 'FRACTIONAL_CPO', label: 'Fractional CPO' },
];

export default function ClientOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    companyName: '',
    companyStage: '',
    industry: '',
    executiveType: '',
    hoursPerWeek: '',
    needs: '',
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push('/executives');
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm">
            {STEPS.map((s, i) => (
              <span key={s} className={i <= step ? 'font-medium text-blue-600' : 'text-gray-400'}>
                {s}
              </span>
            ))}
          </div>
          <Progress className="h-2" value={progress} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 0 && 'Tell Us About Your Company'}
              {step === 1 && 'What Are You Looking For?'}
              {step === 2 && 'Ready to Find Your Executive!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Company */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    placeholder="Your company name"
                    value={data.companyName}
                    onChange={(e) => setData({ ...data, companyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Stage</Label>
                  <Select
                    value={data.companyStage}
                    onValueChange={(v) => setData({ ...data, companyStage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g., FinTech, Healthcare, SaaS"
                    value={data.industry}
                    onChange={(e) => setData({ ...data, industry: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Step 1: Needs */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Executive Type Needed</Label>
                  <Select
                    value={data.executiveType}
                    onValueChange={(v) => setData({ ...data, executiveType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select executive type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXECUTIVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hours Per Week</Label>
                  <Select
                    value={data.hoursPerWeek}
                    onValueChange={(v) => setData({ ...data, hoursPerWeek: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select hours" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5-10">5-10 hours</SelectItem>
                      <SelectItem value="10-20">10-20 hours</SelectItem>
                      <SelectItem value="20-30">20-30 hours</SelectItem>
                      <SelectItem value="30+">30+ hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Specific Needs (optional)</Label>
                  <Textarea
                    placeholder="Describe what you're looking for..."
                    rows={3}
                    value={data.needs}
                    onChange={(e) => setData({ ...data, needs: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Step 2: Complete */}
            {step === 2 && (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
                <h3 className="mb-2 text-xl font-semibold">You're Ready!</h3>
                <p className="mb-6 text-gray-500">
                  Browse our marketplace of vetted executives or submit a match request.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button disabled={step === 0} variant="ghost" onClick={handleBack}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext}>
                {step === STEPS.length - 1 ? 'Browse Executives' : 'Continue'}
                {step < STEPS.length - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
