import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { FileText, Shield, Zap, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Direct Contracts - Skillancer',
  description: 'Work directly with clients you already know using Skillancer payment protection.',
};

const steps = [
  {
    icon: FileText,
    title: 'Create Contract',
    desc: 'Set up terms, milestones, and payment schedule',
  },
  { icon: Users, title: 'Invite Client', desc: 'Send a link to your client to review and accept' },
  { icon: Shield, title: 'Work Protected', desc: 'Get paid securely through our escrow system' },
];

const benefits = [
  'No bidding required',
  'Lower service fees',
  'Full payment protection',
  'Milestone-based payments',
  'Dispute resolution',
  'Work history tracking',
];

export default function DirectContractsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <FileText className="mr-1 h-3 w-3" />
            Direct Contracts
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Bring Your Own Clients</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Work with clients you already know while enjoying Skillancer&apos;s payment protection.
          </p>
          <Button className="mt-6 bg-emerald-500 hover:bg-emerald-600" size="lg">
            Create a Contract
          </Button>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <h2 className="mb-8 text-center text-2xl font-bold">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title}>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-600">
                  {i + 1}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-12">
          <CardContent className="p-8">
            <h2 className="mb-6 text-center text-2xl font-bold">Benefits</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="mt-8 text-center">
          <Link href="/jobs">
            <Button variant="outline">
              Or Browse Jobs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
