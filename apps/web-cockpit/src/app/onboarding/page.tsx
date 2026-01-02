'use client';

/**
 * Executive Onboarding Wizard
 * 4-step onboarding for executives after signup
 */

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@skillancer/ui/card';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Progress } from '@skillancer/ui/progress';
import { RadioGroup, RadioGroupItem } from '@skillancer/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { User, Briefcase, CreditCard, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STEPS = ['Profile', 'Experience', 'Subscription', 'Complete'];

const EXECUTIVE_TYPES = [
  { value: 'FRACTIONAL_CTO', label: 'Fractional CTO' },
  { value: 'FRACTIONAL_CFO', label: 'Fractional CFO' },
  { value: 'FRACTIONAL_CMO', label: 'Fractional CMO' },
  { value: 'FRACTIONAL_COO', label: 'Fractional COO' },
  { value: 'FRACTIONAL_CPO', label: 'Fractional CPO' },
  { value: 'FRACTIONAL_CHRO', label: 'Fractional CHRO' },
  { value: 'FRACTIONAL_CISO', label: 'Fractional CISO' },
];

const PLANS = [
  { tier: 'BASIC', name: 'Basic', price: 199, clients: 5, description: 'Getting started' },
  {
    tier: 'PRO',
    name: 'Professional',
    price: 499,
    clients: 15,
    description: 'Most popular',
    highlight: true,
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    clients: 'Unlimited',
    description: 'Custom pricing',
  },
];

export default function ExecutiveOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    headline: '',
    executiveType: '',
    yearsExperience: '',
    industries: [] as string[],
    selectedPlan: 'PRO',
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push('/');
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
              <span key={s} className={i <= step ? 'font-medium text-purple-600' : 'text-gray-400'}>
                {s}
              </span>
            ))}
          </div>
          <Progress className="h-2" value={progress} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 0 && 'Set Up Your Profile'}
              {step === 1 && 'Your Executive Experience'}
              {step === 2 && 'Choose Your Plan'}
              {step === 3 && "You're All Set!"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Profile */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Professional Headline</Label>
                  <Input
                    placeholder="e.g., Fractional CTO | 20+ Years in FinTech"
                    value={data.headline}
                    onChange={(e) => setData({ ...data, headline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Executive Type</Label>
                  <Select
                    value={data.executiveType}
                    onValueChange={(v) => setData({ ...data, executiveType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your primary role" />
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
              </>
            )}

            {/* Step 1: Experience */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Years of Executive Experience</Label>
                  <Select
                    value={data.yearsExperience}
                    onValueChange={(v) => setData({ ...data, yearsExperience: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-5">1-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10-20">10-20 years</SelectItem>
                      <SelectItem value="20+">20+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-gray-500">
                  You can add detailed work history and achievements after onboarding.
                </p>
              </>
            )}

            {/* Step 2: Plan Selection */}
            {step === 2 && (
              <RadioGroup
                value={data.selectedPlan}
                onValueChange={(v) => setData({ ...data, selectedPlan: v })}
              >
                <div className="grid gap-4">
                  {PLANS.map((plan) => (
                    <label
                      key={plan.tier}
                      className={`relative flex cursor-pointer items-center gap-4 rounded-lg border p-4 ${
                        data.selectedPlan === plan.tier
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200'
                      } ${plan.highlight ? 'ring-2 ring-purple-200' : ''}`}
                    >
                      <RadioGroupItem value={plan.tier} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{plan.name}</span>
                          {plan.highlight && (
                            <Badge className="bg-purple-100 text-purple-700">Popular</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {plan.price ? `$${plan.price}/mo` : 'Custom'}
                        </div>
                        <div className="text-xs text-gray-500">{plan.clients} clients</div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            )}

            {/* Step 3: Complete */}
            {step === 3 && (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
                <h3 className="mb-2 text-xl font-semibold">Welcome to Skillancer!</h3>
                <p className="mb-6 text-gray-500">
                  Your executive profile is set up. Complete your full profile to appear in the
                  marketplace.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button disabled={step === 0} variant="ghost" onClick={handleBack}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext}>
                {step === STEPS.length - 1 ? 'Go to Dashboard' : 'Continue'}
                {step < STEPS.length - 1 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
