import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { Users, MessageSquare, Calendar, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community - Skillancer',
  description: 'Connect with fellow freelancers, share knowledge, and grow together.',
};

const features = [
  {
    icon: MessageSquare,
    title: 'Discussion Forums',
    desc: 'Ask questions, share tips, and connect with peers',
    members: '50K+ members',
  },
  {
    icon: Calendar,
    title: 'Events & Webinars',
    desc: 'Weekly live sessions with industry experts',
    events: '4 per week',
  },
  {
    icon: Trophy,
    title: 'Challenges',
    desc: 'Compete in skill challenges and win prizes',
    prizes: '$10K+ monthly',
  },
  {
    icon: Users,
    title: 'Local Meetups',
    desc: 'Find and join freelancer meetups near you',
    cities: '100+ cities',
  },
];

const discussions = [
  { title: 'Tips for landing your first client', replies: 234, category: 'Getting Started' },
  { title: 'How do you handle scope creep?', replies: 189, category: 'Client Management' },
  { title: 'Best tools for remote work in 2025', replies: 156, category: 'Tools & Resources' },
  { title: 'Pricing strategies that work', replies: 312, category: 'Business' },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Users className="mr-1 h-3 w-3" />
            Community
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Join the Community</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Connect with 500,000+ freelancers. Share knowledge, find support, and grow together.
          </p>
          <Button className="mt-6 bg-emerald-500 hover:bg-emerald-600" size="lg">
            Join Free
          </Button>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="transition-all hover:shadow-lg">
              <CardContent className="p-6 text-center">
                <f.icon className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="mb-2 text-sm text-slate-600">{f.desc}</p>
                <Badge variant="secondary">{f.members || f.events || f.prizes || f.cities}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <h2 className="mb-6 mt-12 text-2xl font-bold">Trending Discussions</h2>
        <div className="space-y-3">
          {discussions.map((d) => (
            <Card key={d.title} className="transition-all hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold">{d.title}</h3>
                  <p className="text-sm text-slate-500">{d.category}</p>
                </div>
                <Badge variant="secondary">{d.replies} replies</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/jobs">
            <Button variant="outline">
              Browse Jobs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
