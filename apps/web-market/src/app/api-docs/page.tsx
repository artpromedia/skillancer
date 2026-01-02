import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { Code, Zap, Shield, Book, Terminal, ArrowRight } from 'lucide-react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer API - Skillancer',
  description:
    'Build integrations with the Skillancer API. Access talent, projects, and payments programmatically.',
};

const endpoints = [
  { method: 'GET', path: '/v1/freelancers', desc: 'List and search freelancers' },
  { method: 'POST', path: '/v1/projects', desc: 'Create new projects' },
  { method: 'GET', path: '/v1/contracts', desc: 'Manage contracts' },
  { method: 'POST', path: '/v1/payments', desc: 'Process payments' },
];

const features = [
  { icon: Zap, title: 'RESTful API', desc: 'Simple, predictable endpoints' },
  { icon: Shield, title: 'OAuth 2.0', desc: 'Secure authentication' },
  { icon: Book, title: 'Full Docs', desc: 'Comprehensive documentation' },
  { icon: Terminal, title: 'SDKs', desc: 'Node.js, Python, PHP, Ruby' },
];

export default function ApiPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Code className="mr-1 h-3 w-3" />
            Developer API
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Build with Skillancer</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Access our platform programmatically. Integrate talent search, project management, and
            payments into your apps.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button className="bg-emerald-500 hover:bg-emerald-600" size="lg">
              Get API Key
            </Button>
            <Button
              className="border-white/20 text-white hover:bg-white/10"
              size="lg"
              variant="outline"
            >
              View Docs
            </Button>
          </div>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6 text-center">
                <f.icon className="mx-auto mb-4 h-10 w-10 text-blue-500" />
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm text-slate-600">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <h2 className="mb-6 mt-12 text-2xl font-bold">API Endpoints</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {endpoints.map((e) => (
              <div key={e.path} className="flex items-center gap-4 p-4">
                <Badge
                  className={
                    e.method === 'GET'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }
                >
                  {e.method}
                </Badge>
                <code className="font-mono text-sm">{e.path}</code>
                <span className="ml-auto text-sm text-slate-500">{e.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="mt-12 rounded-lg bg-slate-900 p-6 text-white">
          <h3 className="mb-4 font-semibold">Quick Start</h3>
          <pre className="overflow-x-auto rounded bg-slate-800 p-4 text-sm">
            <code>{`curl -X GET "https://api.skillancer.com/v1/freelancers" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
