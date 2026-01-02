import { Badge, Card, CardContent } from '@skillancer/ui';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Status - Skillancer',
  description: 'Real-time status of Skillancer services and infrastructure.',
};

const services = [
  { name: 'Website & Apps', status: 'operational', uptime: '99.99%' },
  { name: 'API', status: 'operational', uptime: '99.98%' },
  { name: 'Payment Processing', status: 'operational', uptime: '99.99%' },
  { name: 'Messaging', status: 'operational', uptime: '99.97%' },
  { name: 'File Storage', status: 'operational', uptime: '99.99%' },
  { name: 'Search', status: 'operational', uptime: '99.95%' },
];

const incidents = [
  { date: 'Dec 28, 2025', title: 'Scheduled Maintenance', status: 'resolved', duration: '15 min' },
  { date: 'Dec 20, 2025', title: 'API Latency Issues', status: 'resolved', duration: '8 min' },
  { date: 'Dec 15, 2025', title: 'Search Degradation', status: 'resolved', duration: '22 min' },
];

const getStatusIcon = (status: string) => {
  if (status === 'operational') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'degraded') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-red-500" />;
};

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-4xl font-bold">All Systems Operational</h1>
          <p className="text-slate-400">Last updated: {new Date().toLocaleString()}</p>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold">Services</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {services.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(s.status)}
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{s.uptime} uptime</Badge>
                  <Badge className="bg-emerald-100 capitalize text-emerald-700">{s.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <h2 className="mb-6 mt-12 text-2xl font-bold">Recent Incidents</h2>
        <div className="space-y-4">
          {incidents.map((i) => (
            <Card key={i.title}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold">{i.title}</h3>
                  <p className="text-sm text-slate-500">{i.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sm text-slate-500">
                    <Clock className="h-4 w-4" />
                    {i.duration}
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-700">Resolved</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-12">
          <CardContent className="p-6 text-center">
            <h3 className="mb-2 font-semibold">Subscribe to Updates</h3>
            <p className="mb-4 text-sm text-slate-600">
              Get notified about incidents and maintenance
            </p>
            <div className="mx-auto flex max-w-md gap-2">
              <input
                className="flex-1 rounded-lg border px-4 py-2"
                placeholder="your@email.com"
                type="email"
              />
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600">
                Subscribe
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
