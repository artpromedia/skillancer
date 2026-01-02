import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { DollarSign, Shield, Globe, FileText, CheckCircle2 } from 'lucide-react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Payroll Services - Skillancer',
  description: 'Streamlined payroll management for your global freelance workforce.',
};

const features = [
  {
    icon: Globe,
    title: 'Global Payments',
    desc: 'Pay freelancers in 180+ countries with local currency support',
  },
  {
    icon: Shield,
    title: 'Compliance Built-In',
    desc: 'Automatic tax handling and legal compliance worldwide',
  },
  {
    icon: FileText,
    title: 'Automated Invoicing',
    desc: 'Generate and track invoices automatically',
  },
  { icon: DollarSign, title: 'Flexible Methods', desc: 'Bank transfers, PayPal, crypto, and more' },
];

const benefits = [
  'No hidden fees',
  'Real-time tracking',
  '24/7 support',
  'Enterprise security',
  'Multi-currency',
  'API access',
];

export default function PayrollPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <DollarSign className="mr-1 h-3 w-3" />
            Payroll Services
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Global Payroll Made Simple</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Streamlined payroll management for your global freelance workforce.
          </p>
          <Button className="mt-6 bg-emerald-500 hover:bg-emerald-600" size="lg">
            Get Started Free
          </Button>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6 text-center">
                <f.icon className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-12">
          <CardContent className="p-8">
            <h2 className="mb-6 text-center text-2xl font-bold">Why Choose Skillancer Payroll?</h2>
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
      </div>
    </div>
  );
}
