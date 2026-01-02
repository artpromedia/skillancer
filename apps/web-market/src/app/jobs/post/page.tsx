'use client';

import { Button, Card, CardContent, Badge, Input } from '@skillancer/ui';
import {
  Briefcase,
  DollarSign,
  Clock,
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const categories = [
  {
    id: 'dev',
    name: 'Development & IT',
    icon: '💻',
    subcategories: ['Web Development', 'Mobile Apps', 'Backend', 'DevOps', 'Database', 'AI/ML'],
  },
  {
    id: 'design',
    name: 'Design & Creative',
    icon: '🎨',
    subcategories: ['UI/UX', 'Graphic Design', 'Branding', 'Video', 'Animation', '3D'],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: '📈',
    subcategories: ['SEO', 'Social Media', 'Content', 'PPC', 'Email', 'Analytics'],
  },
  {
    id: 'writing',
    name: 'Writing & Content',
    icon: '✍️',
    subcategories: ['Copywriting', 'Blog Posts', 'Technical Writing', 'Translation', 'Editing'],
  },
  {
    id: 'business',
    name: 'Business',
    icon: '💼',
    subcategories: ['Virtual Assistant', 'Project Management', 'Consulting', 'Finance', 'Legal'],
  },
  {
    id: 'data',
    name: 'Data & AI',
    icon: '🤖',
    subcategories: [
      'Data Analysis',
      'Machine Learning',
      'Data Visualization',
      'Automation',
      'AI Apps',
    ],
  },
];

const budgetTypes = [
  { id: 'fixed', label: 'Fixed Price', description: 'Pay a set amount for the entire project' },
  { id: 'hourly', label: 'Hourly Rate', description: 'Pay by the hour for ongoing work' },
];

const experienceLevels = [
  {
    id: 'entry',
    label: 'Entry Level',
    description: 'Looking for someone new to the field',
    rate: '$15-30/hr',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Looking for substantial experience',
    rate: '$30-75/hr',
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'Looking for comprehensive expertise',
    rate: '$75-150+/hr',
  },
];

const projectDurations = [
  { id: 'short', label: 'Less than 1 week' },
  { id: 'medium', label: '1-4 weeks' },
  { id: 'long', label: '1-3 months' },
  { id: 'ongoing', label: 'More than 3 months' },
];

export default function PostJobPage() {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [budgetType, setBudgetType] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Post a New Project</h1>
              <p className="text-slate-600">Find the perfect freelancer for your project</p>
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-12 rounded-full transition-colors ${
                    i + 1 <= step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div>
              <div className="mb-8 text-center">
                <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  Step 1 of 4
                </Badge>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">
                  What type of work do you need?
                </h2>
                <p className="text-slate-600">
                  Select a category to help us match you with the right talent
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((cat) => (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedCategory === cat.id ? 'border-2 border-emerald-500 bg-emerald-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedSubcategory(null);
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{cat.icon}</span>
                        <div>
                          <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                          <p className="text-sm text-slate-500">
                            {cat.subcategories.length} subcategories
                          </p>
                        </div>
                        {selectedCategory === cat.id && (
                          <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedCategory && (
                <div className="mt-8">
                  <h3 className="mb-4 font-semibold text-slate-900">
                    Select a subcategory (optional)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categories
                      .find((c) => c.id === selectedCategory)
                      ?.subcategories.map((sub) => (
                        <Badge
                          key={sub}
                          className={`cursor-pointer px-4 py-2 transition-colors ${
                            selectedSubcategory === sub
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          onClick={() => setSelectedSubcategory(sub)}
                        >
                          {sub}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Project Details */}
          {step === 2 && (
            <div>
              <div className="mb-8 text-center">
                <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  Step 2 of 4
                </Badge>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">
                  Tell us about your project
                </h2>
                <p className="text-slate-600">
                  A detailed description helps attract the right freelancers
                </p>
              </div>

              <Card>
                <CardContent className="space-y-6 p-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Project Title *
                    </label>
                    <Input
                      className="w-full"
                      placeholder="e.g., Build a modern e-commerce website with React"
                    />
                    <p className="mt-1 text-sm text-slate-500">
                      Write a clear, descriptive title for your project
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Project Description *
                    </label>
                    <textarea
                      className="min-h-[200px] w-full rounded-lg border border-slate-200 p-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Describe your project in detail. Include:
• What you're trying to accomplish
• Any specific requirements or features
• Deliverables you expect
• Technical preferences (if any)"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Skills Required
                    </label>
                    <Input className="w-full" placeholder="e.g., React, Node.js, PostgreSQL" />
                    <p className="mt-1 text-sm text-slate-500">Separate skills with commas</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Attachments (Optional)
                    </label>
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-8 transition-colors hover:border-emerald-500">
                      <div className="text-center">
                        <FileText className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                        <p className="text-sm text-slate-600">
                          Drag and drop files or{' '}
                          <span className="cursor-pointer text-emerald-500">browse</span>
                        </p>
                        <p className="text-xs text-slate-400">PDF, DOC, images up to 10MB each</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Budget & Timeline */}
          {step === 3 && (
            <div>
              <div className="mb-8 text-center">
                <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  Step 3 of 4
                </Badge>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">Budget & Timeline</h2>
                <p className="text-slate-600">Set your budget and project duration</p>
              </div>

              <div className="space-y-8">
                {/* Budget Type */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="mb-4 font-semibold text-slate-900">
                      How would you like to pay?
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {budgetTypes.map((type) => (
                        <div
                          key={type.id}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            budgetType === type.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => setBudgetType(type.id)}
                        >
                          <div className="flex items-center gap-3">
                            <DollarSign
                              className={`h-5 w-5 ${
                                budgetType === type.id ? 'text-emerald-500' : 'text-slate-400'
                              }`}
                            />
                            <div>
                              <p className="font-medium text-slate-900">{type.label}</p>
                              <p className="text-sm text-slate-500">{type.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {budgetType && (
                      <div className="mt-6">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          {budgetType === 'fixed' ? 'Project Budget' : 'Hourly Rate Range'}
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              className="w-32 pl-8"
                              placeholder={budgetType === 'fixed' ? '1000' : '25'}
                              type="number"
                            />
                          </div>
                          {budgetType === 'hourly' && (
                            <>
                              <span className="text-slate-400">to</span>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="w-32 pl-8" placeholder="75" type="number" />
                              </div>
                              <span className="text-slate-500">/hr</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Experience Level */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="mb-4 font-semibold text-slate-900">
                      What level of experience are you looking for?
                    </h3>
                    <div className="space-y-3">
                      {experienceLevels.map((level) => (
                        <div
                          key={level.id}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            experienceLevel === level.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => setExperienceLevel(level.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{level.label}</p>
                              <p className="text-sm text-slate-500">{level.description}</p>
                            </div>
                            <Badge variant="secondary">{level.rate}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Duration */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="mb-4 font-semibold text-slate-900">
                      How long will the project take?
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {projectDurations.map((d) => (
                        <Badge
                          key={d.id}
                          className={`cursor-pointer px-4 py-2 transition-colors ${
                            duration === d.id
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          onClick={() => setDuration(d.id)}
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          {d.label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 4: Review & Post */}
          {step === 4 && (
            <div>
              <div className="mb-8 text-center">
                <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  Step 4 of 4
                </Badge>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">
                  Review and Post Your Project
                </h2>
                <p className="text-slate-600">Make sure everything looks good before posting</p>
              </div>

              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-sm text-slate-500">Category</p>
                        <p className="font-medium text-slate-900">
                          {categories.find((c) => c.id === selectedCategory)?.name ||
                            'Not selected'}
                          {selectedSubcategory && ` → ${selectedSubcategory}`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                        Edit
                      </Button>
                    </div>

                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-sm text-slate-500">Project Title</p>
                        <p className="font-medium text-slate-900">Your project title here</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
                        Edit
                      </Button>
                    </div>

                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-sm text-slate-500">Budget</p>
                        <p className="font-medium text-slate-900">
                          {budgetType === 'fixed' ? 'Fixed Price' : 'Hourly Rate'}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setStep(3)}>
                        Edit
                      </Button>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Experience Level</p>
                        <p className="font-medium text-slate-900">
                          {experienceLevels.find((l) => l.id === experienceLevel)?.label ||
                            'Not selected'}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setStep(3)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefits */}
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-emerald-50 p-4 text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-900">AI Matching</p>
                  <p className="text-xs text-slate-500">Get matched with top talent</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <Zap className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                  <p className="text-sm font-medium text-slate-900">Fast Responses</p>
                  <p className="text-xs text-slate-500">Proposals within hours</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-4 text-center">
                  <Shield className="mx-auto mb-2 h-6 w-6 text-purple-500" />
                  <p className="text-sm font-medium text-slate-900">Secure Payments</p>
                  <p className="text-xs text-slate-500">Money-back guarantee</p>
                </div>
              </div>

              <div className="text-center">
                <Button className="bg-emerald-500 px-8 text-white hover:bg-emerald-600" size="lg">
                  <Briefcase className="mr-2 h-5 w-5" />
                  Post Project — It&apos;s Free
                </Button>
                <p className="mt-3 text-sm text-slate-500">
                  Your project will be visible to thousands of freelancers
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <Link href="/jobs">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Browse Jobs
                </Button>
              </Link>
            )}

            {step < totalSteps && (
              <Button
                className="bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={step === 1 && !selectedCategory}
                onClick={handleNext}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
