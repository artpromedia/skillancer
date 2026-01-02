'use client';

import {
  MapPinIcon,
  BriefcaseIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  SparklesIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  AcademicCapIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Contract';
  level: string;
  posted: string;
  description: string;
}

const departments = [
  'All Departments',
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Customer Success',
  'Operations',
  'Legal',
  'Finance',
  'People',
];

const locations = [
  'All Locations',
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
  'Berlin, Germany',
  'Singapore',
];

const openPositions: Job[] = [
  {
    id: 'sr-frontend',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    posted: '2 days ago',
    description:
      'Build the next generation of our freelancer marketplace using React, TypeScript, and Next.js.',
  },
  {
    id: 'backend-eng',
    title: 'Backend Engineer',
    department: 'Engineering',
    location: 'San Francisco, CA',
    type: 'Full-time',
    level: 'Mid-Level',
    posted: '1 week ago',
    description:
      'Design and implement scalable microservices using Node.js, PostgreSQL, and Kubernetes.',
  },
  {
    id: 'product-manager',
    title: 'Product Manager - Marketplace',
    department: 'Product',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    posted: '3 days ago',
    description:
      'Lead product strategy for our core marketplace features, driving growth and engagement.',
  },
  {
    id: 'ux-designer',
    title: 'Senior UX Designer',
    department: 'Design',
    location: 'New York, NY',
    type: 'Full-time',
    level: 'Senior',
    posted: '5 days ago',
    description:
      'Create intuitive, delightful experiences for millions of freelancers and clients.',
  },
  {
    id: 'ml-engineer',
    title: 'Machine Learning Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    posted: '1 week ago',
    description: 'Build AI-powered matching algorithms and recommendation systems.',
  },
  {
    id: 'growth-marketing',
    title: 'Growth Marketing Manager',
    department: 'Marketing',
    location: 'London, UK',
    type: 'Full-time',
    level: 'Mid-Level',
    posted: '4 days ago',
    description: 'Drive user acquisition and retention through data-driven marketing campaigns.',
  },
  {
    id: 'enterprise-sales',
    title: 'Enterprise Account Executive',
    department: 'Sales',
    location: 'San Francisco, CA',
    type: 'Full-time',
    level: 'Senior',
    posted: '1 week ago',
    description: 'Build relationships with Fortune 500 companies and close enterprise deals.',
  },
  {
    id: 'customer-success',
    title: 'Customer Success Manager',
    department: 'Customer Success',
    location: 'Remote',
    type: 'Full-time',
    level: 'Mid-Level',
    posted: '6 days ago',
    description: 'Ensure our enterprise clients achieve their goals and maximize platform value.',
  },
];

const benefits = [
  {
    icon: CurrencyDollarIcon,
    title: 'Competitive Compensation',
    description: 'Top-of-market salaries, equity packages, and performance bonuses.',
  },
  {
    icon: HeartIcon,
    title: 'Health & Wellness',
    description: 'Comprehensive health, dental, and vision coverage for you and your family.',
  },
  {
    icon: HomeIcon,
    title: 'Flexible Work',
    description: 'Remote-first culture with flexible hours and home office stipend.',
  },
  {
    icon: AcademicCapIcon,
    title: 'Learning & Development',
    description: '$5,000 annual learning budget for courses, conferences, and books.',
  },
  {
    icon: SparklesIcon,
    title: 'Unlimited PTO',
    description: 'Take the time you need to recharge and do your best work.',
  },
  {
    icon: UserGroupIcon,
    title: 'Team Events',
    description: 'Regular team offsites, virtual events, and a culture of celebration.',
  },
];

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      className="block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
      href={`/careers/${job.id}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
            {job.title}
          </h3>
          <p className="mt-1 font-medium text-green-600">{job.department}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          {job.type}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-gray-600">{job.description}</p>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <MapPinIcon className="h-4 w-4" />
          {job.location}
        </div>
        <div className="flex items-center gap-1">
          <BriefcaseIcon className="h-4 w-4" />
          {job.level}
        </div>
        <div className="flex items-center gap-1">
          <ClockIcon className="h-4 w-4" />
          {job.posted}
        </div>
      </div>
    </Link>
  );
}

export default function CareersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');

  const filteredJobs = openPositions.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment =
      selectedDepartment === 'All Departments' || job.department === selectedDepartment;
    const matchesLocation =
      selectedLocation === 'All Locations' || job.location === selectedLocation;
    return matchesSearch && matchesDepartment && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-600 to-green-700 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Join Our Mission
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-green-100">
            Help us build the future of work. We're looking for passionate people who want to
            empower freelancers and transform how the world works.
          </p>
          <div className="mt-10">
            <a
              className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-green-600 transition-colors hover:bg-gray-50"
              href="#positions"
            >
              View Open Positions
              <RocketLaunchIcon className="ml-2 h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            <div>
              <p className="text-4xl font-bold text-green-600">250+</p>
              <p className="mt-2 text-gray-600">Team Members</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-600">30+</p>
              <p className="mt-2 text-gray-600">Countries</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-600">85%</p>
              <p className="mt-2 text-gray-600">Remote Workers</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-green-600">4.8</p>
              <p className="mt-2 text-gray-600">Glassdoor Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Us */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why Join Skillancer?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              We offer competitive benefits and a culture that puts our people first.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl bg-gray-50 p-6 transition-colors hover:bg-gray-100"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <benefit.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{benefit.title}</h3>
                <p className="mt-2 text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="bg-gray-50 py-16" id="positions">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Open Positions</h2>
            <p className="mt-4 text-lg text-gray-600">
              {openPositions.length} open roles across all departments
            </p>
          </div>

          {/* Filters */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 py-3 pl-12 pr-4 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="Search positions..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 pr-10 text-gray-900 focus:border-green-500 focus:ring-green-500 md:w-48"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-gray-300 px-4 py-3 pr-10 text-gray-900 focus:border-green-500 focus:ring-green-500 md:w-48"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Job Listings */}
          {filteredJobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
              <p className="text-gray-600">No positions match your criteria.</p>
              <button
                className="mt-4 font-medium text-green-600 hover:text-green-500"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDepartment('All Departments');
                  setSelectedLocation('All Locations');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Life at Skillancer */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Life at Skillancer</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              We believe in building a diverse, inclusive, and supportive workplace where everyone
              can do their best work.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-green-200"
              >
                <span className="text-sm font-medium text-green-600">Team Photo {i}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Don't see the right role?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
            We're always looking for talented people. Send us your resume and we'll reach out when a
            matching position opens up.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-green-500"
            href="/contact?subject=careers"
          >
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/about">
              About Us
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/leadership">
              Leadership
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/press">
              Press
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
