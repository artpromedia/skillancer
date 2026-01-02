'use client';

import { LinkedinIcon, TwitterIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Leader {
  id: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  linkedin?: string;
  twitter?: string;
}

// Placeholder leaders - will be replaced with actual profiles
const executiveTeam: Leader[] = [
  {
    id: 'ceo',
    name: 'Coming Soon',
    title: 'Chief Executive Officer',
    bio: 'Our CEO brings decades of experience in technology and marketplace platforms, driving our vision to transform the future of work.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'cto',
    name: 'Coming Soon',
    title: 'Chief Technology Officer',
    bio: 'Leading our engineering teams to build secure, scalable, and innovative solutions that power the Skillancer platform.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'coo',
    name: 'Coming Soon',
    title: 'Chief Operating Officer',
    bio: 'Overseeing daily operations and ensuring seamless experiences for freelancers and clients worldwide.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'cfo',
    name: 'Coming Soon',
    title: 'Chief Financial Officer',
    bio: 'Managing financial strategy and operations to support sustainable growth and stakeholder value.',
    image: '/images/placeholder-leader.jpg',
  },
];

const leadershipTeam: Leader[] = [
  {
    id: 'vp-product',
    name: 'Coming Soon',
    title: 'VP of Product',
    bio: 'Driving product strategy and innovation to create the best experience for our community.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'vp-engineering',
    name: 'Coming Soon',
    title: 'VP of Engineering',
    bio: 'Building and leading world-class engineering teams to deliver cutting-edge technology.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'vp-marketing',
    name: 'Coming Soon',
    title: 'VP of Marketing',
    bio: 'Crafting our brand story and driving awareness across global markets.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'vp-sales',
    name: 'Coming Soon',
    title: 'VP of Sales',
    bio: 'Leading enterprise sales and partnerships to expand our platform reach.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'vp-hr',
    name: 'Coming Soon',
    title: 'VP of People',
    bio: 'Building an inclusive culture and attracting top talent to join our mission.',
    image: '/images/placeholder-leader.jpg',
  },
  {
    id: 'vp-legal',
    name: 'Coming Soon',
    title: 'General Counsel',
    bio: 'Ensuring compliance and protecting the interests of our community and stakeholders.',
    image: '/images/placeholder-leader.jpg',
  },
];

function LeaderCard({ leader }: { leader: Leader }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-300 hover:shadow-xl">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-green-100 to-green-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-300/50">
            <span className="text-4xl font-bold text-green-600">
              {leader.name === 'Coming Soon' ? '?' : leader.name.charAt(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 transition-colors group-hover:text-green-600">
          {leader.name}
        </h3>
        <p className="mt-1 font-medium text-green-600">{leader.title}</p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{leader.bio}</p>

        {/* Social Links */}
        {(leader.linkedin || leader.twitter) && (
          <div className="mt-4 flex gap-3 border-t border-gray-100 pt-4">
            {leader.linkedin && (
              <a
                className="text-gray-400 transition-colors hover:text-blue-600"
                href={leader.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                <LinkedinIcon className="h-5 w-5" />
              </a>
            )}
            {leader.twitter && (
              <a
                className="text-gray-400 transition-colors hover:text-blue-400"
                href={leader.twitter}
                rel="noopener noreferrer"
                target="_blank"
              >
                <TwitterIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadershipPage() {
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
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Our Leadership
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-600">
            Meet the team driving Skillancer's mission to transform the future of work. Our leaders
            bring decades of experience from top technology companies and a shared passion for
            empowering the freelance economy.
          </p>
        </div>
      </section>

      {/* Executive Team */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Executive Team</h2>
            <p className="mt-4 text-lg text-gray-600">
              The visionaries leading our company forward
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {executiveTeam.map((leader) => (
              <LeaderCard key={leader.id} leader={leader} />
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Leadership Team</h2>
            <p className="mt-4 text-lg text-gray-600">
              Experts driving innovation across every function
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {leadershipTeam.map((leader) => (
              <LeaderCard key={leader.id} leader={leader} />
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Our Values</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              The principles that guide every decision we make
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-green-50 p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Trust First</h3>
              <p className="text-gray-600">
                We build trust through transparency, security, and verified credentials. Every
                feature we create strengthens the bond between freelancers and clients.
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Innovation Driven</h3>
              <p className="text-gray-600">
                We leverage AI, security, and cutting-edge technology to create solutions that
                didn't exist before.
              </p>
            </div>

            <div className="rounded-2xl bg-purple-50 p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                <svg
                  className="h-8 w-8 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Community Focused</h3>
              <p className="text-gray-600">
                Our success is measured by the success of our community. We empower freelancers and
                clients to achieve their goals together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Join Our Team</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-green-100">
            We're always looking for talented individuals who share our passion for transforming the
            future of work.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-green-600 transition-colors hover:bg-gray-50"
            href="/careers"
          >
            View Open Positions
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
            <Link className="text-gray-600 hover:text-green-600" href="/careers">
              Careers
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
