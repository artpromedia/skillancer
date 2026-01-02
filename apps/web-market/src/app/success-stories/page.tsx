'use client';

import {
  StarIcon,
  PlayIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';

interface SuccessStory {
  id: string;
  name: string;
  role: string;
  avatar: string;
  location: string;
  category: 'freelancer' | 'client' | 'agency';
  industry: string;
  headline: string;
  story: string;
  metrics: { label: string; value: string }[];
  quote: string;
  featured: boolean;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  text: string;
  rating: number;
}

const successStories: SuccessStory[] = [
  {
    id: 'aivo-ai-learning',
    name: 'Aivo AI Learning Technologies Inc',
    role: 'Enterprise Client',
    avatar: 'AI',
    location: 'San Francisco, CA',
    category: 'client',
    industry: 'EdTech / AI',
    headline: 'Building the Future of AI-Powered Education with Global Talent',
    story:
      "Aivo AI Learning Technologies Inc needed to rapidly expand their engineering and content teams to develop their revolutionary AI tutoring platform. Traditional hiring couldn't keep pace with their growth trajectory. Through Skillancer, they assembled a world-class team of ML engineers, curriculum designers, and UX specialists from 12 countries, launching their platform 3 months ahead of schedule.",
    metrics: [
      { label: 'Time to Market', value: '-3 months' },
      { label: 'Team Assembled', value: '45+ experts' },
      { label: 'Cost Efficiency', value: '40% saved' },
    ],
    quote:
      "Skillancer gave us access to specialized AI and education talent that simply wasn't available locally. The quality of work exceeded our expectations, and the platform made managing a global team seamless.",
    featured: true,
  },
  {
    id: 'ceerion-inc',
    name: 'Ceerion Inc',
    role: 'Enterprise Client',
    avatar: 'CE',
    location: 'Austin, TX',
    category: 'client',
    industry: 'Enterprise Software',
    headline: 'Scaling Product Development 5x Without Sacrificing Quality',
    story:
      'Ceerion Inc, a fast-growing enterprise software company, faced the challenge of scaling their product development while maintaining their high quality standards. By partnering with Skillancer Enterprise, they built dedicated pods of senior developers, QA engineers, and DevOps specialists who integrated seamlessly with their in-house team. The result: 5x faster feature delivery and a 60% reduction in time-to-market.',
    metrics: [
      { label: 'Development Speed', value: '5x faster' },
      { label: 'Quality Score', value: '99.2%' },
      { label: 'Annual Savings', value: '$3.2M' },
    ],
    quote:
      'Skillancer Enterprise transformed how we think about building software. We now have access to top-tier global talent that works as an extension of our team. The ROI has been incredible.',
    featured: true,
  },
  {
    id: 'aivo-ai-ml-team',
    name: 'Aivo AI - ML Engineering Team',
    role: 'Project Success Story',
    avatar: 'ML',
    location: 'Global Team',
    category: 'client',
    industry: 'Machine Learning',
    headline: 'Assembling a World-Class ML Team in Record Time',
    story:
      'When Aivo AI needed to build their proprietary learning recommendation engine, they turned to Skillancer to find specialized ML talent. Within 3 weeks, they had assembled a team of 8 senior ML engineers from the US, India, and Europe. The team delivered a production-ready recommendation system that improved student learning outcomes by 40%.',
    metrics: [
      { label: 'Team Assembly', value: '3 weeks' },
      { label: 'Learning Improvement', value: '+40%' },
      { label: 'Models Deployed', value: '12' },
    ],
    quote:
      'Finding ML engineers with experience in educational AI is incredibly difficult. Skillancer connected us with exactly the talent we needed, and the results speak for themselves.',
    featured: true,
  },
  {
    id: 'ceerion-platform-redesign',
    name: 'Ceerion Inc - Platform Modernization',
    role: 'Project Success Story',
    avatar: 'CP',
    location: 'Austin, TX',
    category: 'client',
    industry: 'Enterprise Software',
    headline: 'Complete Platform Redesign Delivered On Time and Under Budget',
    story:
      "Ceerion's legacy platform needed a complete modernization to stay competitive. Using Skillancer, they assembled a cross-functional team of React developers, cloud architects, and UX designers. The team delivered a modern, scalable platform that increased user engagement by 150% and reduced infrastructure costs by 45%.",
    metrics: [
      { label: 'User Engagement', value: '+150%' },
      { label: 'Infra Cost Savings', value: '45%' },
      { label: 'Team Size', value: '22 experts' },
    ],
    quote:
      'The Skillancer team understood our enterprise needs from day one. The quality of talent and the support we received made this our most successful project to date.',
    featured: false,
  },
  {
    id: 'aivo-content-team',
    name: 'Aivo AI - Content Development',
    role: 'Project Success Story',
    avatar: 'AC',
    location: 'Global Team',
    category: 'client',
    industry: 'EdTech',
    headline: 'Creating 10,000+ Hours of AI-Curated Educational Content',
    story:
      'To power their AI tutoring platform, Aivo AI needed to develop thousands of hours of educational content across multiple subjects. Through Skillancer, they built a network of 50+ subject matter experts, instructional designers, and content creators who produced high-quality, AI-ready educational materials.',
    metrics: [
      { label: 'Content Hours', value: '10,000+' },
      { label: 'Subject Areas', value: '15' },
      { label: 'Content Creators', value: '50+' },
    ],
    quote:
      'Building an educational content library at this scale would have taken years with traditional methods. Skillancer helped us do it in months.',
    featured: false,
  },
  {
    id: 'ceerion-devops',
    name: 'Ceerion Inc - DevOps Transformation',
    role: 'Project Success Story',
    avatar: 'DO',
    location: 'Austin, TX',
    category: 'client',
    industry: 'Cloud Infrastructure',
    headline: 'From Monthly to Daily Deployments with Zero Downtime',
    story:
      'Ceerion needed to modernize their deployment pipeline to support their growing customer base. Skillancer connected them with DevOps experts who implemented CI/CD pipelines, containerization, and infrastructure-as-code. The result: deployment frequency increased from monthly to daily, with zero-downtime releases.',
    metrics: [
      { label: 'Deploy Frequency', value: 'Daily' },
      { label: 'Downtime', value: '0 hours' },
      { label: 'Pipeline Speed', value: '10x faster' },
    ],
    quote:
      'Our DevOps transformation would not have been possible without the specialized talent we found on Skillancer. The expertise level was exactly what we needed.',
    featured: false,
  },
];

const testimonials: Testimonial[] = [
  {
    name: 'CTO',
    role: 'Executive Leadership',
    company: 'Aivo AI Learning Technologies Inc',
    text: "Skillancer helped us build our entire ML and content team in record time. The quality of talent and the platform's enterprise features made scaling our AI education platform possible.",
    rating: 5,
  },
  {
    name: 'VP of Engineering',
    role: 'Engineering Leadership',
    company: 'Ceerion Inc',
    text: "We've transformed our development velocity with Skillancer. The ability to quickly assemble specialized teams for different projects has been a game-changer for our product roadmap.",
    rating: 5,
  },
  {
    name: 'Head of Product',
    role: 'Product Leadership',
    company: 'Aivo AI Learning Technologies Inc',
    text: 'Finding ML engineers with EdTech experience seemed impossible until we discovered Skillancer. Now we have access to world-class talent whenever we need it.',
    rating: 5,
  },
];

const stats = [
  { value: '1.2M+', label: 'Successful Projects', icon: ChartBarIcon },
  { value: '$2.1B+', label: 'Paid to Freelancers', icon: CurrencyDollarIcon },
  { value: '180+', label: 'Countries', icon: GlobeAltIcon },
  { value: '95%', label: 'Client Satisfaction', icon: StarIcon },
];

const categoryFilters = [
  { label: 'All Stories', value: 'all' },
  { label: 'Freelancers', value: 'freelancer' },
  { label: 'Clients', value: 'client' },
  { label: 'Agencies', value: 'agency' },
];

export default function SuccessStoriesPage() {
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
      <section className="bg-gradient-to-b from-green-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Success Stories
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-600">
            Discover how freelancers, clients, and agencies are achieving their goals and
            transforming their businesses with Skillancer.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="mx-auto mb-2 h-8 w-8 text-green-600" />
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2">
            {categoryFilters.map((filter) => (
              <button
                key={filter.value}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter.value === 'all'
                    ? 'bg-green-600 text-white'
                    : 'border border-gray-300 bg-white text-gray-600 hover:border-green-300 hover:text-green-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Story */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Featured Story</h2>

          {successStories
            .filter((s) => s.featured)
            .slice(0, 1)
            .map((story) => (
              <div
                key={story.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
              >
                <div className="lg:grid lg:grid-cols-2">
                  {/* Video/Image Placeholder */}
                  <div className="flex min-h-[300px] items-center justify-center bg-gray-900 lg:min-h-[400px]">
                    <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30">
                      <PlayIcon className="h-8 w-8 text-white" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-8 lg:p-12">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-600">
                        {story.avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{story.name}</p>
                        <p className="text-sm text-gray-500">
                          {story.role} • {story.location}
                        </p>
                      </div>
                    </div>

                    <h3 className="mb-4 text-2xl font-bold text-gray-900">{story.headline}</h3>

                    <p className="mb-6 text-gray-600">{story.story}</p>

                    <blockquote className="mb-6 border-l-4 border-green-600 pl-4 italic text-gray-700">
                      "{story.quote}"
                    </blockquote>

                    <div className="grid grid-cols-3 gap-4">
                      {story.metrics.map((metric) => (
                        <div key={metric.label}>
                          <p className="text-xl font-bold text-green-600">{metric.value}</p>
                          <p className="text-xs text-gray-500">{metric.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* All Stories Grid */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">More Success Stories</h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {successStories.slice(1).map((story) => (
              <article
                key={story.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-lg"
              >
                {/* Category Badge */}
                <div className="border-b border-gray-100 p-4">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                      story.category === 'freelancer'
                        ? 'bg-blue-100 text-blue-600'
                        : story.category === 'client'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    {story.category.charAt(0).toUpperCase() + story.category.slice(1)}
                  </span>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600">
                      {story.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{story.name}</p>
                      <p className="text-sm text-gray-500">{story.location}</p>
                    </div>
                  </div>

                  <h3 className="mb-3 text-lg font-semibold text-gray-900">{story.headline}</h3>

                  <p className="mb-4 line-clamp-3 text-sm text-gray-600">{story.story}</p>

                  <div className="flex justify-between border-t border-gray-100 pt-4">
                    {story.metrics.slice(0, 2).map((metric) => (
                      <div key={metric.label}>
                        <p className="font-bold text-green-600">{metric.value}</p>
                        <p className="text-xs text-gray-500">{metric.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Read More */}
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <Link
                    className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
                    href={`/success-stories/${story.id}`}
                  >
                    Read full story
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            What Our Community Says
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-xl border border-gray-200 bg-white p-6"
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarSolidIcon key={i} className="h-5 w-5 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-4 text-gray-600">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-xs text-gray-500">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-green-600 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to Write Your Success Story?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-green-100">
            Join millions of freelancers and businesses who are achieving their goals with
            Skillancer.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-green-600 transition-colors hover:bg-gray-100"
              href="/signup?type=freelancer"
            >
              Start as Freelancer
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border-2 border-white px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
              href="/how-to-hire"
            >
              Hire Talent
            </Link>
          </div>
        </div>
      </section>

      {/* Share Your Story */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <UserGroupIcon className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Share Your Story</h2>
          <p className="mb-6 text-gray-600">
            Have a success story to share? We'd love to hear how Skillancer has helped you achieve
            your goals. Your story could inspire others in our community.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
            href="/contact?subject=success-story"
          >
            Submit Your Story
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-find-work">
              For Freelancers
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-hire">
              For Clients
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/enterprise">
              Enterprise
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/blog">
              Blog
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
