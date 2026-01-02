'use client';

import {
  CodeBracketIcon,
  PaintBrushIcon,
  PencilSquareIcon,
  MegaphoneIcon,
  ChartBarIcon,
  CpuChipIcon,
  MusicalNoteIcon,
  VideoCameraIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  LanguageIcon,
  WrenchScrewdriverIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Category {
  name: string;
  slug: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  jobCount: number;
  subcategories: string[];
  color: string;
}

const categories: Category[] = [
  {
    name: 'Web Development',
    slug: 'web-development',
    description: 'Build modern websites and web applications with cutting-edge technologies.',
    icon: CodeBracketIcon,
    jobCount: 1245,
    subcategories: [
      'Frontend',
      'Backend',
      'Full Stack',
      'WordPress',
      'E-commerce',
      'API Development',
    ],
    color: 'bg-blue-500',
  },
  {
    name: 'Mobile Development',
    slug: 'mobile-development',
    description: 'Create native and cross-platform mobile apps for iOS and Android.',
    icon: CpuChipIcon,
    jobCount: 892,
    subcategories: ['iOS Development', 'Android Development', 'React Native', 'Flutter', 'Xamarin'],
    color: 'bg-green-500',
  },
  {
    name: 'Design & Creative',
    slug: 'design-creative',
    description: 'Bring ideas to life with stunning visuals and creative solutions.',
    icon: PaintBrushIcon,
    jobCount: 1567,
    subcategories: [
      'UI/UX Design',
      'Graphic Design',
      'Logo Design',
      'Brand Identity',
      'Illustration',
    ],
    color: 'bg-purple-500',
  },
  {
    name: 'Writing & Content',
    slug: 'writing-content',
    description: 'Craft compelling content that engages and converts audiences.',
    icon: PencilSquareIcon,
    jobCount: 1123,
    subcategories: [
      'Copywriting',
      'Content Writing',
      'Technical Writing',
      'Blog Writing',
      'Ghostwriting',
    ],
    color: 'bg-orange-500',
  },
  {
    name: 'Digital Marketing',
    slug: 'digital-marketing',
    description: 'Grow businesses through strategic digital marketing campaigns.',
    icon: MegaphoneIcon,
    jobCount: 743,
    subcategories: [
      'SEO',
      'Social Media',
      'PPC Advertising',
      'Email Marketing',
      'Content Marketing',
    ],
    color: 'bg-pink-500',
  },
  {
    name: 'Data & Analytics',
    slug: 'data-analytics',
    description: 'Turn data into actionable insights and business intelligence.',
    icon: ChartBarIcon,
    jobCount: 621,
    subcategories: [
      'Data Analysis',
      'Data Science',
      'Machine Learning',
      'Business Intelligence',
      'Data Visualization',
    ],
    color: 'bg-cyan-500',
  },
  {
    name: 'Video & Animation',
    slug: 'video-animation',
    description: 'Produce engaging video content and stunning animations.',
    icon: VideoCameraIcon,
    jobCount: 456,
    subcategories: [
      'Video Editing',
      'Motion Graphics',
      '2D Animation',
      '3D Animation',
      'Explainer Videos',
    ],
    color: 'bg-red-500',
  },
  {
    name: 'Music & Audio',
    slug: 'music-audio',
    description: 'Create professional audio content and music production.',
    icon: MusicalNoteIcon,
    jobCount: 312,
    subcategories: [
      'Music Production',
      'Voice Over',
      'Sound Design',
      'Podcast Editing',
      'Audio Mastering',
    ],
    color: 'bg-indigo-500',
  },
  {
    name: 'Business & Consulting',
    slug: 'business-consulting',
    description: 'Expert advice and strategic guidance for business growth.',
    icon: BuildingOfficeIcon,
    jobCount: 534,
    subcategories: [
      'Business Strategy',
      'Financial Consulting',
      'HR Consulting',
      'Project Management',
      'Operations',
    ],
    color: 'bg-gray-600',
  },
  {
    name: 'Education & Training',
    slug: 'education-training',
    description: 'Share knowledge through teaching and course creation.',
    icon: AcademicCapIcon,
    jobCount: 287,
    subcategories: [
      'Online Tutoring',
      'Course Creation',
      'Curriculum Design',
      'E-learning',
      'Training Materials',
    ],
    color: 'bg-amber-500',
  },
  {
    name: 'Translation',
    slug: 'translation',
    description: 'Bridge language barriers with professional translation services.',
    icon: LanguageIcon,
    jobCount: 423,
    subcategories: [
      'Document Translation',
      'Website Localization',
      'Transcription',
      'Interpretation',
      'Proofreading',
    ],
    color: 'bg-teal-500',
  },
  {
    name: 'Engineering & Architecture',
    slug: 'engineering-architecture',
    description: 'Design and engineer solutions for the physical world.',
    icon: WrenchScrewdriverIcon,
    jobCount: 198,
    subcategories: [
      'CAD Design',
      'Structural Engineering',
      'Electrical Engineering',
      '3D Modeling',
      'Product Design',
    ],
    color: 'bg-slate-600',
  },
];

const featuredSkills = [
  'JavaScript',
  'React',
  'Python',
  'Node.js',
  'TypeScript',
  'UI/UX Design',
  'WordPress',
  'SEO',
  'Data Analysis',
  'Video Editing',
  'Copywriting',
  'iOS Development',
];

export default function CategoriesPage() {
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
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Browse Categories
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Find the perfect freelancer for your project. Explore our categories to discover
              talented professionals in every field.
            </p>
          </div>

          {/* Featured Skills */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {featuredSkills.map((skill) => (
              <Link
                key={skill}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                href={`/jobs?skill=${encodeURIComponent(skill)}`}
              >
                {skill}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                className="group relative rounded-2xl border border-gray-200 bg-white p-8 transition-all hover:border-green-300 hover:shadow-xl"
                href={`/jobs?category=${category.slug}`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-xl ${category.color}`}
                  >
                    <category.icon className="h-7 w-7 text-white" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {category.jobCount.toLocaleString()} jobs
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-gray-900 transition-colors group-hover:text-green-600">
                  {category.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{category.description}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {category.subcategories.slice(0, 4).map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center rounded-md bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600"
                    >
                      {sub}
                    </span>
                  ))}
                  {category.subcategories.length > 4 && (
                    <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium text-gray-500">
                      +{category.subcategories.length - 4} more
                    </span>
                  )}
                </div>

                <div className="mt-6 flex items-center text-sm font-medium text-green-600 group-hover:text-green-500">
                  Browse jobs
                  <ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Searches */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">Popular Searches</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {[
              'React Developer',
              'Logo Designer',
              'WordPress Expert',
              'SEO Specialist',
              'Content Writer',
              'Mobile App Developer',
              'Video Editor',
              'Virtual Assistant',
              'Data Analyst',
              'Social Media Manager',
              'Python Developer',
              'UI/UX Designer',
            ].map((search) => (
              <Link
                key={search}
                className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-700 transition-all hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                href={`/jobs?q=${encodeURIComponent(search)}`}
              >
                {search}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-green-600 to-green-700 p-8 text-center sm:p-12 lg:p-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to start your project?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-green-100">
              Post your job for free and get proposals from talented freelancers within hours.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-green-600 transition-colors hover:bg-gray-50"
                href="/signup"
              >
                Post a Job
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-lg border-2 border-white px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-green-500"
                href="/freelancers"
              >
                Browse Freelancers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-gray-200 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            <div>
              <p className="text-4xl font-bold text-gray-900">50K+</p>
              <p className="mt-2 text-gray-600">Active Freelancers</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">12</p>
              <p className="mt-2 text-gray-600">Main Categories</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">100+</p>
              <p className="mt-2 text-gray-600">Subcategories</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">8K+</p>
              <p className="mt-2 text-gray-600">Open Jobs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact Us
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/faq">
              FAQ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
