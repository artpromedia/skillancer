import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  Search,
  Filter,
  Star,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  Briefcase,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Talent - Find Skilled Freelancers',
  description:
    'Browse our network of verified freelancers. Find developers, designers, writers, and more for your next project.',
};

// Sample talent data
const featuredTalent = [
  {
    id: '1',
    name: 'Alex Johnson',
    title: 'Senior Full-Stack Developer',
    location: 'San Francisco, USA',
    rating: 4.9,
    reviews: 127,
    hourlyRate: 85,
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    completedJobs: 89,
    successRate: 98,
    verified: true,
  },
  {
    id: '2',
    name: 'Sarah Kim',
    title: 'UI/UX Design Lead',
    location: 'London, UK',
    rating: 5.0,
    reviews: 195,
    hourlyRate: 95,
    skills: ['Figma', 'Webflow', 'Branding', 'User Research'],
    completedJobs: 156,
    successRate: 100,
    verified: true,
  },
  {
    id: '3',
    name: 'Marcus Chen',
    title: 'AI/ML Engineer',
    location: 'Singapore',
    rating: 4.8,
    reviews: 142,
    hourlyRate: 120,
    skills: ['Python', 'TensorFlow', 'GPT', 'Data Science'],
    completedJobs: 67,
    successRate: 97,
    verified: true,
  },
  {
    id: '4',
    name: 'Emma Wilson',
    title: 'Marketing Strategist',
    location: 'Sydney, Australia',
    rating: 4.9,
    reviews: 88,
    hourlyRate: 75,
    skills: ['SEO', 'Content Strategy', 'Analytics', 'Social Media'],
    completedJobs: 112,
    successRate: 96,
    verified: true,
  },
  {
    id: '5',
    name: 'David Park',
    title: 'Mobile App Developer',
    location: 'Seoul, South Korea',
    rating: 4.7,
    reviews: 76,
    hourlyRate: 90,
    skills: ['React Native', 'Swift', 'Kotlin', 'Firebase'],
    completedJobs: 45,
    successRate: 95,
    verified: true,
  },
  {
    id: '6',
    name: 'Lisa Martinez',
    title: 'Technical Writer',
    location: 'Austin, USA',
    rating: 4.9,
    reviews: 203,
    hourlyRate: 65,
    skills: ['Documentation', 'API Docs', 'Copywriting', 'UX Writing'],
    completedJobs: 178,
    successRate: 99,
    verified: true,
  },
];

const categories = [
  'All Categories',
  'Development & IT',
  'Design & Creative',
  'Marketing',
  'Writing',
  'AI & Data Science',
  'Video & Animation',
  'Business',
];

export default function TalentPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Users className="mr-1 h-3 w-3" />
            500,000+ Verified Professionals
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Find World-Class Talent
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Browse our network of verified freelancers. Every professional is skill-tested and
            vetted for quality.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-8 max-w-2xl">
            <div className="flex overflow-hidden rounded-xl bg-white shadow-lg">
              <div className="flex flex-1 items-center gap-3 px-4">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  className="h-14 flex-1 border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="Search by skill, role, or keyword..."
                  type="text"
                />
              </div>
              <Button className="m-2 h-10 rounded-lg bg-emerald-500 px-6 text-white hover:bg-emerald-600">
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-64">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-semibold">Filters</h3>
                  <Button size="sm" variant="ghost">
                    Clear all
                  </Button>
                </div>

                {/* Category Filter */}
                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-medium text-slate-700">Category</h4>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <label
                        key={cat}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                      >
                        <input
                          className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                          name="category"
                          type="radio"
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Hourly Rate Filter */}
                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-medium text-slate-700">Hourly Rate</h4>
                  <div className="space-y-2">
                    {['$0 - $25', '$25 - $50', '$50 - $100', '$100+'].map((range) => (
                      <label
                        key={range}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                      >
                        <input
                          className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                          type="checkbox"
                        />
                        {range}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-slate-700">Experience Level</h4>
                  <div className="space-y-2">
                    {['Entry Level', 'Intermediate', 'Expert'].map((level) => (
                      <label
                        key={level}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                      >
                        <input
                          className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                          type="checkbox"
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Talent Grid */}
          <main className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-slate-600">
                Showing <span className="font-semibold">1-6</span> of{' '}
                <span className="font-semibold">500,000+</span> professionals
              </p>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>Best Match</option>
                  <option>Highest Rated</option>
                  <option>Most Reviews</option>
                  <option>Lowest Rate</option>
                  <option>Highest Rate</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredTalent.map((talent) => (
                <Link key={talent.id} href={`/freelancers/${talent.id}`}>
                  <Card className="h-full transition-all hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="p-6">
                      {/* Avatar & Name */}
                      <div className="mb-4 flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-xl font-bold text-white">
                          {talent.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{talent.name}</h3>
                            {talent.verified && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600">{talent.title}</p>
                        </div>
                      </div>

                      {/* Location & Rate */}
                      <div className="mb-4 flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {talent.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {talent.hourlyRate}/hr
                        </span>
                      </div>

                      {/* Skills */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {talent.skills.slice(0, 3).map((skill) => (
                          <Badge
                            key={skill}
                            className="bg-slate-100 text-slate-600"
                            variant="secondary"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {talent.skills.length > 3 && (
                          <Badge className="bg-slate-100 text-slate-600" variant="secondary">
                            +{talent.skills.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-slate-900">{talent.rating}</span>
                          <span className="text-sm text-slate-500">({talent.reviews})</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-4 w-4" />
                            {talent.completedJobs}
                          </span>
                          <span className="text-emerald-600">{talent.successRate}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Load More */}
            <div className="mt-8 text-center">
              <Button size="lg" variant="outline">
                Load More Talent
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
