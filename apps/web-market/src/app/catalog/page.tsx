import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { Star, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Project Catalog - Ready-Made Services',
  description:
    'Browse pre-packaged services from top freelancers. Fixed prices, clear deliverables.',
};

const projects = [
  {
    id: '1',
    title: 'Logo Design Package',
    category: 'Design',
    price: 299,
    rating: 4.9,
    reviews: 234,
    delivery: '3 days',
  },
  {
    id: '2',
    title: 'WordPress Website',
    category: 'Development',
    price: 599,
    rating: 4.8,
    reviews: 189,
    delivery: '7 days',
  },
  {
    id: '3',
    title: 'SEO Audit Report',
    category: 'Marketing',
    price: 199,
    rating: 4.9,
    reviews: 156,
    delivery: '2 days',
  },
  {
    id: '4',
    title: 'Social Media Kit',
    category: 'Design',
    price: 249,
    rating: 4.7,
    reviews: 98,
    delivery: '4 days',
  },
  {
    id: '5',
    title: 'Mobile App UI Design',
    category: 'Design',
    price: 899,
    rating: 5.0,
    reviews: 67,
    delivery: '10 days',
  },
  {
    id: '6',
    title: 'Video Intro Animation',
    category: 'Video',
    price: 149,
    rating: 4.8,
    reviews: 212,
    delivery: '2 days',
  },
];

export default function CatalogPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Project Catalog
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Ready-Made Services</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Browse pre-packaged services with fixed prices and clear deliverables.
          </p>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="transition-all hover:-translate-y-1 hover:shadow-lg">
              <CardContent className="p-6">
                <Badge className="mb-3" variant="secondary">
                  {p.category}
                </Badge>
                <h3 className="mb-2 text-lg font-semibold">{p.title}</h3>
                <div className="mb-4 flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {p.rating} ({p.reviews})
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {p.delivery}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-emerald-600">${p.price}</span>
                  <Button size="sm">View Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/jobs">
            <Button variant="outline">
              Browse All Jobs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
