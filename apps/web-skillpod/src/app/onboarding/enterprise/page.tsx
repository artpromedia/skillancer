'use client';

/**
 * Enterprise Onboarding Wizard
 * 6-step guided onboarding for B2B customers
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Shield,
  Settings,
  CreditCard,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  AlertCircle,
  Download,
  Link as LinkIcon,
  Key,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Textarea } from '@skillancer/ui/textarea';
import { Checkbox } from '@skillancer/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@skillancer/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { useToast } from '@skillancer/ui/use-toast';
import { Progress } from '@skillancer/ui/progress';

// =============================================================================
// TYPES
// =============================================================================

interface CompanyInfo {
  companyName: string;
  industry: string;
  employeeCount: string;
  website: string;
  billingEmail: string;
  technicalContact: {
    name: string;
    email: string;
    phone: string;
  };
}

interface TeamSetup {
  initialAdmins: Array<{ email: string; role: 'SUPER_ADMIN' | 'SECURITY_ADMIN' }>;
  estimatedUsers: number;
  departments: string[];
}

interface SecurityConfig {
  ssoProvider: 'none' | 'okta' | 'azure_ad' | 'google' | 'custom_saml';
  mfaRequired: boolean;
  ipWhitelisting: boolean;
  allowedIpRanges: string[];
  sessionTimeout: number;
  dataRetentionDays: number;
}

interface PolicyConfig {
  defaultPolicy: 'restrictive' | 'balanced' | 'permissive';
  enableRecording: boolean;
  enableWatermarking: boolean;
  blockClipboard: boolean;
  blockFileTransfer: boolean;
  blockScreenshots: boolean;
}

interface PlanSelection {
  planId: 'STARTER' | 'PRO' | 'ENTERPRISE';
  billingPeriod: 'monthly' | 'annual';
  acceptedTerms: boolean;
  acceptedDpa: boolean;
}

interface OnboardingData {
  company: CompanyInfo;
  team: TeamSetup;
  security: SecurityConfig;
  policies: PolicyConfig;
  plan: PlanSelection;
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

const STEPS = [
  { id: 'company', title: 'Company Info', icon: Building2 },
  { id: 'team', title: 'Team Setup', icon: Users },
  { id: 'security', title: 'Security', icon: Shield },
  { id: 'policies', title: 'Policies', icon: Settings },
  { id: 'plan', title: 'Select Plan', icon: CreditCard },
  { id: 'complete', title: 'Complete', icon: CheckCircle },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-12 sm:w-20 ${
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <span
            key={step.id}
            className={`text-xs ${
              index === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
            }`}
          >
            {step.title}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompanyInfoStep({
  data,
  onChange,
}: {
  data: CompanyInfo;
  onChange: (data: CompanyInfo) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Tell us about your company</h2>
        <p className="text-muted-foreground">
          This information helps us customize SkillPod for your organization.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={data.companyName}
            onChange={(e) => onChange({ ...data, companyName: e.target.value })}
            placeholder="Acme Corporation"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Company Website</Label>
          <Input
            id="website"
            type="url"
            value={data.website}
            onChange={(e) => onChange({ ...data, website: e.target.value })}
            placeholder="https://acme.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry *</Label>
          <Select value={data.industry} onValueChange={(v) => onChange({ ...data, industry: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technology">Technology</SelectItem>
              <SelectItem value="finance">Finance & Banking</SelectItem>
              <SelectItem value="healthcare">Healthcare</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="retail">Retail & E-commerce</SelectItem>
              <SelectItem value="consulting">Consulting</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeCount">Company Size *</Label>
          <Select
            value={data.employeeCount}
            onValueChange={(v) => onChange({ ...data, employeeCount: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1-10">1-10 employees</SelectItem>
              <SelectItem value="11-50">11-50 employees</SelectItem>
              <SelectItem value="51-200">51-200 employees</SelectItem>
              <SelectItem value="201-500">201-500 employees</SelectItem>
              <SelectItem value="501-1000">501-1000 employees</SelectItem>
              <SelectItem value="1000+">1000+ employees</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="billingEmail">Billing Email *</Label>
          <Input
            id="billingEmail"
            type="email"
            value={data.billingEmail}
            onChange={(e) => onChange({ ...data, billingEmail: e.target.value })}
            placeholder="billing@acme.com"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="mb-4 text-lg font-semibold">Technical Contact</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={data.technicalContact.name}
              onChange={(e) =>
                onChange({
                  ...data,
                  technicalContact: { ...data.technicalContact, name: e.target.value },
                })
              }
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={data.technicalContact.email}
              onChange={(e) =>
                onChange({
                  ...data,
                  technicalContact: { ...data.technicalContact, email: e.target.value },
                })
              }
              placeholder="jane@acme.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              type="tel"
              value={data.technicalContact.phone}
              onChange={(e) =>
                onChange({
                  ...data,
                  technicalContact: { ...data.technicalContact, phone: e.target.value },
                })
              }
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSetupStep({
  data,
  onChange,
}: {
  data: TeamSetup;
  onChange: (data: TeamSetup) => void;
}) {
  const addAdmin = () => {
    onChange({
      ...data,
      initialAdmins: [...data.initialAdmins, { email: '', role: 'SECURITY_ADMIN' }],
    });
  };

  const updateAdmin = (index: number, field: 'email' | 'role', value: string) => {
    const newAdmins = [...data.initialAdmins];
    newAdmins[index] = { ...newAdmins[index], [field]: value };
    onChange({ ...data, initialAdmins: newAdmins });
  };

  const removeAdmin = (index: number) => {
    onChange({
      ...data,
      initialAdmins: data.initialAdmins.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Set up your team</h2>
        <p className="text-muted-foreground">
          Add your initial administrators and configure team structure.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Initial Administrators</Label>
          <Button variant="outline" size="sm" onClick={addAdmin}>
            Add Admin
          </Button>
        </div>

        {data.initialAdmins.map((admin, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-1">
              <Input
                type="email"
                value={admin.email}
                onChange={(e) => updateAdmin(index, 'email', e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
            <Select value={admin.role} onValueChange={(v) => updateAdmin(index, 'role', v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="SECURITY_ADMIN">Security Admin</SelectItem>
              </SelectContent>
            </Select>
            {index > 0 && (
              <Button variant="ghost" size="icon" onClick={() => removeAdmin(index)}>
                ×
              </Button>
            )}
          </div>
        ))}

        <p className="text-muted-foreground text-sm">
          Super Admins have full access. Security Admins can manage policies and security settings.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="estimatedUsers">Estimated Number of Users</Label>
        <Input
          id="estimatedUsers"
          type="number"
          min="1"
          value={data.estimatedUsers}
          onChange={(e) => onChange({ ...data, estimatedUsers: Number.parseInt(e.target.value) || 1 })}
        />
        <p className="text-muted-foreground text-sm">
          This helps us recommend the right plan for you.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Departments (optional)</Label>
        <Textarea
          value={data.departments.join('\n')}
          onChange={(e) =>
            onChange({ ...data, departments: e.target.value.split('\n').filter(Boolean) })
          }
          placeholder="Engineering&#10;Marketing&#10;Sales&#10;Support"
          rows={4}
        />
        <p className="text-muted-foreground text-sm">
          Enter one department per line. Used for organizing users and reports.
        </p>
      </div>
    </div>
  );
}

function SecurityConfigStep({
  data,
  onChange,
}: {
  data: SecurityConfig;
  onChange: (data: SecurityConfig) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Configure security</h2>
        <p className="text-muted-foreground">
          Set up authentication and security policies for your organization.
        </p>
      </div>

      <div className="space-y-4">
        <Label>Single Sign-On (SSO)</Label>
        <RadioGroup
          value={data.ssoProvider}
          onValueChange={(v) =>
            onChange({ ...data, ssoProvider: v as SecurityConfig['ssoProvider'] })
          }
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {[
            { value: 'none', label: 'No SSO', desc: 'Use email/password' },
            { value: 'okta', label: 'Okta', desc: 'SAML 2.0' },
            { value: 'azure_ad', label: 'Azure AD', desc: 'OIDC / SAML' },
            { value: 'google', label: 'Google Workspace', desc: 'OIDC' },
            { value: 'custom_saml', label: 'Custom SAML', desc: 'Any SAML 2.0 IdP' },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-4 transition-colors ${
                data.ssoProvider === option.value
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted-foreground/50'
              }`}
            >
              <RadioGroupItem value={option.value} />
              <div>
                <p className="font-medium">{option.label}</p>
                <p className="text-muted-foreground text-sm">{option.desc}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Require MFA</p>
            <p className="text-muted-foreground text-sm">
              All users must enable two-factor authentication
            </p>
          </div>
          <Checkbox
            checked={data.mfaRequired}
            onCheckedChange={(c) => onChange({ ...data, mfaRequired: c === true })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">IP Whitelisting</p>
            <p className="text-muted-foreground text-sm">Restrict access to specific IP ranges</p>
          </div>
          <Checkbox
            checked={data.ipWhitelisting}
            onCheckedChange={(c) => onChange({ ...data, ipWhitelisting: c === true })}
          />
        </div>

        {data.ipWhitelisting && (
          <div className="space-y-2 pl-6">
            <Label>Allowed IP Ranges (CIDR notation)</Label>
            <Textarea
              value={data.allowedIpRanges.join('\n')}
              onChange={(e) =>
                onChange({ ...data, allowedIpRanges: e.target.value.split('\n').filter(Boolean) })
              }
              placeholder="192.168.1.0/24&#10;10.0.0.0/8"
              rows={3}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 border-t pt-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Session Timeout (minutes)</Label>
          <Select
            value={data.sessionTimeout.toString()}
            onValueChange={(v) => onChange({ ...data, sessionTimeout: Number.parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="480">8 hours</SelectItem>
              <SelectItem value="1440">24 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Data Retention (days)</Label>
          <Select
            value={data.dataRetentionDays.toString()}
            onValueChange={(v) => onChange({ ...data, dataRetentionDays: Number.parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">180 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
              <SelectItem value="730">2 years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function PolicyConfigStep({
  data,
  onChange,
}: {
  data: PolicyConfig;
  onChange: (data: PolicyConfig) => void;
}) {
  const presets = {
    restrictive: {
      enableRecording: true,
      enableWatermarking: true,
      blockClipboard: true,
      blockFileTransfer: true,
      blockScreenshots: true,
    },
    balanced: {
      enableRecording: true,
      enableWatermarking: true,
      blockClipboard: false,
      blockFileTransfer: true,
      blockScreenshots: false,
    },
    permissive: {
      enableRecording: false,
      enableWatermarking: false,
      blockClipboard: false,
      blockFileTransfer: false,
      blockScreenshots: false,
    },
  };

  const applyPreset = (preset: 'restrictive' | 'balanced' | 'permissive') => {
    onChange({ ...data, defaultPolicy: preset, ...presets[preset] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Default security policies</h2>
        <p className="text-muted-foreground">
          Configure default containment and monitoring policies for all sessions.
        </p>
      </div>

      <div className="space-y-4">
        <Label>Policy Preset</Label>
        <RadioGroup
          value={data.defaultPolicy}
          onValueChange={(v) => applyPreset(v as 'restrictive' | 'balanced' | 'permissive')}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          {[
            {
              value: 'restrictive',
              label: 'Restrictive',
              desc: 'Maximum security, all protections enabled',
            },
            {
              value: 'balanced',
              label: 'Balanced',
              desc: 'Good security with some flexibility',
            },
            {
              value: 'permissive',
              label: 'Permissive',
              desc: 'Minimal restrictions, maximum productivity',
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col rounded-lg border p-4 transition-colors ${
                data.defaultPolicy === option.value
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted-foreground/50'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <RadioGroupItem value={option.value} />
                <span className="font-medium">{option.label}</span>
              </div>
              <p className="text-muted-foreground text-sm">{option.desc}</p>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="border-t pt-6">
        <h3 className="mb-4 text-lg font-semibold">Customize Settings</h3>
        <div className="space-y-4">
          {[
            {
              key: 'enableRecording',
              label: 'Session Recording',
              desc: 'Record all VDI sessions for audit',
            },
            {
              key: 'enableWatermarking',
              label: 'Screen Watermarking',
              desc: 'Display user info overlay on screen',
            },
            {
              key: 'blockClipboard',
              label: 'Block Clipboard',
              desc: 'Prevent copy/paste between host and VDI',
            },
            {
              key: 'blockFileTransfer',
              label: 'Block File Transfer',
              desc: 'Prevent file uploads/downloads',
            },
            {
              key: 'blockScreenshots',
              label: 'Block Screenshots',
              desc: 'Prevent screen capture software',
            },
          ].map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{setting.label}</p>
                <p className="text-muted-foreground text-sm">{setting.desc}</p>
              </div>
              <Checkbox
                checked={data[setting.key as keyof PolicyConfig] as boolean}
                onCheckedChange={(c) => onChange({ ...data, [setting.key]: c === true })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="text-muted-foreground mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-medium">These are default settings</p>
            <p className="text-muted-foreground text-sm">
              You can create additional policies and assign them to specific users or departments
              after setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanSelectionStep({
  data,
  estimatedUsers,
  onChange,
}: {
  data: PlanSelection;
  estimatedUsers: number;
  onChange: (data: PlanSelection) => void;
}) {
  const plans = [
    {
      id: 'STARTER',
      name: 'Starter',
      price: 99,
      users: 5,
      features: ['5 users', '10GB storage', 'Basic policies', 'Email support'],
    },
    {
      id: 'PRO',
      name: 'Pro',
      price: 299,
      users: 25,
      features: ['25 users', '100GB storage', 'SSO', 'API access', 'Priority support'],
      recommended: estimatedUsers > 5 && estimatedUsers <= 25,
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      price: null,
      users: -1,
      features: [
        'Unlimited users',
        'Unlimited storage',
        'SCIM',
        'Custom integrations',
        'Dedicated support',
      ],
      recommended: estimatedUsers > 25,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-bold">Choose your plan</h2>
        <p className="text-muted-foreground">
          Based on your team size of ~{estimatedUsers} users, we recommend the highlighted plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all ${
              data.planId === plan.id
                ? 'border-primary border-2 shadow-lg'
                : 'hover:border-muted-foreground/50'
            } ${plan.recommended ? 'ring-primary/20 ring-2' : ''}`}
            onClick={() => onChange({ ...data, planId: plan.id as PlanSelection['planId'] })}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.recommended && (
                  <span className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs">
                    Recommended
                  </span>
                )}
              </div>
              <CardDescription>
                {plan.price ? (
                  <>
                    <span className="text-foreground text-2xl font-bold">${plan.price}</span>
                    /month
                  </>
                ) : (
                  <span className="text-foreground text-lg font-medium">Custom pricing</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.planId !== 'ENTERPRISE' && (
        <div className="flex items-center gap-4">
          <Label>Billing Period:</Label>
          <RadioGroup
            value={data.billingPeriod}
            onValueChange={(v) => onChange({ ...data, billingPeriod: v as 'monthly' | 'annual' })}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2">
              <RadioGroupItem value="monthly" />
              <span>Monthly</span>
            </label>
            <label className="flex items-center gap-2">
              <RadioGroupItem value="annual" />
              <span>Annual (save 20%)</span>
            </label>
          </RadioGroup>
        </div>
      )}

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={data.acceptedTerms}
            onCheckedChange={(c) => onChange({ ...data, acceptedTerms: c === true })}
          />
          <label htmlFor="terms" className="text-sm">
            I agree to the{' '}
            <a href="/legal/terms" className="text-primary underline" target="_blank">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/legal/privacy" className="text-primary underline" target="_blank">
              Privacy Policy
            </a>
          </label>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="dpa"
            checked={data.acceptedDpa}
            onCheckedChange={(c) => onChange({ ...data, acceptedDpa: c === true })}
          />
          <label htmlFor="dpa" className="text-sm">
            I agree to the{' '}
            <a href="/legal/dpa" className="text-primary underline" target="_blank">
              Data Processing Agreement
            </a>
          </label>
        </div>
      </div>
    </div>
  );
}

function CompletionStep({ companyName }: { companyName: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
      </div>

      <h2 className="mb-4 text-3xl font-bold">Welcome to SkillPod!</h2>
      <p className="text-muted-foreground mx-auto mb-8 max-w-md text-lg">
        Your organization "{companyName}" has been successfully set up. Here's what happens next:
      </p>

      <div className="mx-auto mb-8 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="text-primary mx-auto mb-3 h-8 w-8" />
            <h3 className="mb-1 font-semibold">Invite Your Team</h3>
            <p className="text-muted-foreground text-sm">Admins will receive invites shortly</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Key className="text-primary mx-auto mb-3 h-8 w-8" />
            <h3 className="mb-1 font-semibold">Configure SSO</h3>
            <p className="text-muted-foreground text-sm">Complete your IdP integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Shield className="text-primary mx-auto mb-3 h-8 w-8" />
            <h3 className="mb-1 font-semibold">Fine-tune Policies</h3>
            <p className="text-muted-foreground text-sm">Customize security settings</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline" asChild>
          <a href="https://docs.skillancer.io/skillpod/quickstart" target="_blank">
            <Download className="mr-2 h-4 w-4" />
            Download Quickstart Guide
          </a>
        </Button>
        <Button asChild>
          <a href="/admin/tenant">
            Go to Admin Dashboard
            <ChevronRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

const initialData: OnboardingData = {
  company: {
    companyName: '',
    industry: '',
    employeeCount: '',
    website: '',
    billingEmail: '',
    technicalContact: { name: '', email: '', phone: '' },
  },
  team: {
    initialAdmins: [{ email: '', role: 'SUPER_ADMIN' }],
    estimatedUsers: 10,
    departments: [],
  },
  security: {
    ssoProvider: 'none',
    mfaRequired: true,
    ipWhitelisting: false,
    allowedIpRanges: [],
    sessionTimeout: 60,
    dataRetentionDays: 90,
  },
  policies: {
    defaultPolicy: 'balanced',
    enableRecording: true,
    enableWatermarking: true,
    blockClipboard: false,
    blockFileTransfer: true,
    blockScreenshots: false,
  },
  plan: {
    planId: 'PRO',
    billingPeriod: 'monthly',
    acceptedTerms: false,
    acceptedDpa: false,
  },
};

export default function EnterpriseOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);

  const provisionMutation = useMutation({
    mutationFn: async (payload: OnboardingData) => {
      const response = await fetch('/api/onboarding/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Provisioning failed');
      }
      return response.json();
    },
    onSuccess: () => {
      setCurrentStep(5); // Move to completion step
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: // Company Info
        return (
          data.company.companyName &&
          data.company.industry &&
          data.company.employeeCount &&
          data.company.billingEmail &&
          data.company.technicalContact.name &&
          data.company.technicalContact.email
        );
      case 1: // Team Setup
        return (
          data.team.initialAdmins.length > 0 &&
          data.team.initialAdmins[0].email &&
          data.team.estimatedUsers > 0
        );
      case 2: // Security
        return true; // All fields have defaults
      case 3: // Policies
        return true; // All fields have defaults
      case 4: // Plan Selection
        return data.plan.acceptedTerms && data.plan.acceptedDpa;
      default:
        return true;
    }
  }, [currentStep, data]);

  const handleNext = () => {
    if (currentStep === 4) {
      // Submit
      provisionMutation.mutate(data);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => s - 1);
  };

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">SkillPod Enterprise</h1>
          <p className="text-muted-foreground">Secure Virtual Desktop Infrastructure</p>
        </div>

        {currentStep < 5 && <StepIndicator currentStep={currentStep} />}

        <Card className="p-6 md:p-8">
          {currentStep === 0 && (
            <CompanyInfoStep
              data={data.company}
              onChange={(company) => setData({ ...data, company })}
            />
          )}
          {currentStep === 1 && (
            <TeamSetupStep data={data.team} onChange={(team) => setData({ ...data, team })} />
          )}
          {currentStep === 2 && (
            <SecurityConfigStep
              data={data.security}
              onChange={(security) => setData({ ...data, security })}
            />
          )}
          {currentStep === 3 && (
            <PolicyConfigStep
              data={data.policies}
              onChange={(policies) => setData({ ...data, policies })}
            />
          )}
          {currentStep === 4 && (
            <PlanSelectionStep
              data={data.plan}
              estimatedUsers={data.team.estimatedUsers}
              onChange={(plan) => setData({ ...data, plan })}
            />
          )}
          {currentStep === 5 && <CompletionStep companyName={data.company.companyName} />}

          {/* Navigation */}
          {currentStep < 5 && (
            <div className="mt-8 flex justify-between border-t pt-6">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!canProceed() || provisionMutation.isPending}>
                {provisionMutation.isPending
                  ? 'Processing...'
                  : currentStep === 4
                    ? 'Complete Setup'
                    : 'Continue'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Help */}
        {currentStep < 5 && (
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Need help?{' '}
              <a href="mailto:support@skillancer.io" className="text-primary underline">
                Contact our enterprise team
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
