import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { BookOpen, Award, TrendingUp, Users, Play, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Career Development - Skillancer',
  description: 'Level up your freelance career with courses, certifications, and resources.',
};

const resources = [
  {
    icon: BookOpen,
    title: 'Free Courses',
    desc: '100+ courses on in-demand skills',
    count: '120 courses',
  },
  { icon: Award, title: 'Certifications', desc: 'Get certified to stand out', count: '25 certs' },
  {
    icon: TrendingUp,
    title: 'Skill Assessments',
    desc: 'Prove your expertise with tests',
    count: '50+ skills',
  },
  { icon: Users, title: 'Mentorship', desc: 'Learn from top freelancers', count: '200 mentors' },
];

const courses = [
  { title: 'Freelance Business 101', category: 'Business', duration: '2 hours', free: true },
  {
    title: 'Mastering Client Communication',
    category: 'Soft Skills',
    duration: '1.5 hours',
    free: true,
  },
  { title: 'Advanced React Patterns', category: 'Development', duration: '4 hours', free: false },
  { title: 'UI Design Fundamentals', category: 'Design', duration: '3 hours', free: true },
];

export default function CareerPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <TrendingUp className="mr-1 h-3 w-3" />
            Career Development
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Level Up Your Career</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Free courses, certifications, and resources to grow your freelance business.
          </p>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {resources.map((r) => (
            <Card key={r.title} className="transition-all hover:shadow-lg">
              <CardContent className="p-6 text-center">
                <r.icon className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
                <h3 className="mb-1 font-semibold">{r.title}</h3>
                <p className="mb-2 text-sm text-slate-600">{r.desc}</p>
                <Badge variant="secondary">{r.count}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <h2 className="mb-6 mt-12 text-2xl font-bold">Popular Courses</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <Card key={c.title} className="transition-all hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                    <Play className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="text-sm text-slate-500">
                      {c.category} • {c.duration}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    c.free ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }
                >
                  {c.free ? 'Free' : 'Pro'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/jobs">
            <Button variant="outline">
              Find Work <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
