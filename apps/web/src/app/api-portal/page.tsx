'use client';

/**
 * Intelligence API Portal - Landing Page
 * Sprint M10: Talent Intelligence API
 */

import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@skillancer/ui/card';
import { ArrowRight, BarChart3, TrendingUp, Users, Zap, Shield, Code } from 'lucide-react';
import Link from 'next/link';

export default function APIPortalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              <Zap className="mr-2 h-4 w-4" />
              Talent Intelligence API
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Power your decisions with
              <span className="text-blue-600"> real-time talent data</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-600">
              Access Skillancer's proprietary data on freelance rates, talent availability, and
              skill demand. Build smarter workforce planning tools, competitive intelligence, and
              market analysis applications.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/api-portal/docs">
                <Button size="lg">
                  View Documentation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/api-portal/pricing">
                <Button size="lg" variant="outline">
                  See Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Data you can't find anywhere else</h2>
            <p className="mt-4 text-lg text-gray-600">
              Unique insights from millions of freelance engagements
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Rate Benchmarking</CardTitle>
                <CardDescription>
                  Real-time hourly rate data by skill, experience level, and location
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Percentile distributions (p10, p25, p50, p75, p90)</li>
                  <li>• Historical trends and forecasts</li>
                  <li>• Location-adjusted comparisons</li>
                  <li>• Experience level breakdowns</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Talent Availability</CardTitle>
                <CardDescription>
                  Know when and where skilled freelancers are available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Real-time availability counts</li>
                  <li>• 7/30/90 day projections</li>
                  <li>• Timezone distribution</li>
                  <li>• Capacity forecasting</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Demand Signals</CardTitle>
                <CardDescription>
                  Understand which skills are in demand and emerging trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Skill demand scores</li>
                  <li>• Emerging skills tracking</li>
                  <li>• Declining skills alerts</li>
                  <li>• Industry breakdowns</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Workforce Planning</CardTitle>
                <CardDescription>
                  Build teams with confidence using data-driven estimates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Team cost estimation</li>
                  <li>• Skill gap analysis</li>
                  <li>• Scenario planning</li>
                  <li>• Hiring option comparison</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Privacy-First</CardTitle>
                <CardDescription>
                  All data is aggregated and anonymized for privacy protection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• k-Anonymity guaranteed</li>
                  <li>• Differential privacy noise</li>
                  <li>• No individual data exposed</li>
                  <li>• GDPR/CCPA compliant</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-100">
                  <Code className="h-6 w-6 text-cyan-600" />
                </div>
                <CardTitle>Developer Friendly</CardTitle>
                <CardDescription>
                  Easy to integrate with SDKs, OpenAPI, and clear documentation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• JavaScript & Python SDKs</li>
                  <li>• OpenAPI 3.0 specification</li>
                  <li>• Interactive API explorer</li>
                  <li>• Webhook notifications</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Built for enterprise use cases</h2>
            <p className="mt-4 text-lg text-gray-600">
              Power your applications with talent intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                HR Tech & Staffing Platforms
              </h3>
              <p className="mb-4 text-gray-600">
                Enhance your platform with real-time market rate data. Help clients set competitive
                compensation and understand talent supply.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Salary benchmarking widgets</li>
                <li>✓ Talent availability indicators</li>
                <li>✓ Skills demand insights</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Financial & Investment Research
              </h3>
              <p className="mb-4 text-gray-600">
                Track labor market trends as leading indicators. Understand tech adoption through
                skill demand patterns.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Tech hiring velocity metrics</li>
                <li>✓ Skill adoption tracking</li>
                <li>✓ Regional labor market analysis</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Enterprise Workforce Planning
              </h3>
              <p className="mb-4 text-gray-600">
                Make data-driven build vs. buy decisions. Forecast costs and timelines for building
                remote teams.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Team cost estimation</li>
                <li>✓ Location optimization</li>
                <li>✓ Skills gap analysis</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Market Intelligence Products
              </h3>
              <p className="mb-4 text-gray-600">
                Build competitive intelligence and market research products powered by unique
                freelance market data.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Competitive rate analysis</li>
                <li>✓ Market trend reports</li>
                <li>✓ Custom research datasets</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mb-8 text-lg text-blue-100">
            Sign up for a free trial and explore our API with 100 free requests.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/api-portal/dashboard">
              <Button size="lg" variant="secondary">
                Get API Key
              </Button>
            </Link>
            <Link href="/api-portal/docs">
              <Button
                className="border-white bg-transparent text-white hover:bg-white hover:text-blue-600"
                size="lg"
                variant="outline"
              >
                Read the Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
            <div>
              <h3 className="mb-4 font-semibold text-white">API</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link className="hover:text-white" href="/api-portal/docs">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/pricing">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/status">
                    Status
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/changelog">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-white">SDKs</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link className="hover:text-white" href="/api-portal/sdk/javascript">
                    JavaScript
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/sdk/python">
                    Python
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/sdk/go">
                    Go (Coming)
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-white">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link className="hover:text-white" href="/api-portal/support">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/faq">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/sla">
                    SLA
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-white">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link className="hover:text-white" href="/api-portal/terms">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/privacy">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/api-portal/dpa">
                    DPA
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Skillancer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
