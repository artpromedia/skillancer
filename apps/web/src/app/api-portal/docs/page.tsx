'use client';

/**
 * Intelligence API Portal - Documentation Page
 * Sprint M10: Talent Intelligence API
 */

import { Button } from '@skillancer/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import { ChevronRight, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const endpoints = [
  {
    category: 'Rate Benchmarking',
    items: [
      {
        method: 'GET',
        path: '/v1/rates/benchmark',
        description: 'Get rate benchmarks for a skill',
        params: ['skill', 'experience_level?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/rates/compare',
        description: 'Compare rates across multiple skills',
        params: ['skills', 'experience_level?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/rates/history',
        description: 'Get historical rate trends',
        params: ['skill', 'periods?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/rates/by-location',
        description: 'Get rates breakdown by location',
        params: ['skill', 'experience_level?'],
      },
      {
        method: 'GET',
        path: '/v1/rates/by-experience',
        description: 'Get rates breakdown by experience level',
        params: ['skill', 'location?'],
      },
    ],
  },
  {
    category: 'Talent Availability',
    items: [
      {
        method: 'GET',
        path: '/v1/availability/current',
        description: 'Get current talent availability',
        params: ['skill', 'experience_level?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/availability/forecast',
        description: 'Forecast future availability',
        params: ['skill', 'periods?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/availability/by-region',
        description: 'Get availability by geographic region',
        params: ['skill', 'experience_level?'],
      },
      {
        method: 'GET',
        path: '/v1/availability/trends',
        description: 'Get availability trends over time',
        params: ['skill', 'periods?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/availability/by-timezone',
        description: 'Get availability by timezone distribution',
        params: ['skill', 'experience_level?'],
      },
    ],
  },
  {
    category: 'Skill Demand',
    items: [
      {
        method: 'GET',
        path: '/v1/demand/current',
        description: 'Get current demand for a skill',
        params: ['skill', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/demand/trends',
        description: 'Get demand trends with forecast',
        params: ['skill', 'periods?', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/demand/emerging',
        description: 'Get emerging high-growth skills',
        params: ['category?', 'limit?'],
      },
      {
        method: 'GET',
        path: '/v1/demand/declining',
        description: 'Get declining skills',
        params: ['category?', 'limit?'],
      },
      {
        method: 'GET',
        path: '/v1/demand/correlations',
        description: 'Get skill correlations',
        params: ['skill', 'limit?'],
      },
      {
        method: 'GET',
        path: '/v1/demand/by-industry',
        description: 'Get demand by industry',
        params: ['skill'],
      },
      {
        method: 'GET',
        path: '/v1/demand/heatmap',
        description: 'Get demand heatmap by region',
        params: ['skill'],
      },
    ],
  },
  {
    category: 'Workforce Planning',
    items: [
      {
        method: 'POST',
        path: '/v1/workforce/estimate',
        description: 'Estimate team cost and timeline',
        params: ['skills[]', 'project_duration', 'start_date', 'budget?'],
      },
      {
        method: 'GET',
        path: '/v1/workforce/skill-gaps',
        description: 'Analyze skill gaps in the market',
        params: ['skills', 'location?'],
      },
      {
        method: 'GET',
        path: '/v1/workforce/market-report',
        description: 'Get comprehensive market report',
        params: ['category?', 'location?'],
      },
      {
        method: 'POST',
        path: '/v1/workforce/scenarios',
        description: 'Run scenario analysis',
        params: ['skills[]', 'project_duration', 'start_date'],
      },
      {
        method: 'GET',
        path: '/v1/workforce/compare-options',
        description: 'Compare freelance vs FTE vs agency',
        params: ['skill', 'hours_per_week', 'duration_months'],
      },
    ],
  },
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
        <code>{code}</code>
      </pre>
      <button
        className="absolute right-2 top-2 rounded bg-gray-800 p-2 hover:bg-gray-700"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400" />
        )}
      </button>
    </div>
  );
}

export default function APIDocsPage() {
  const [activeCategory, setActiveCategory] = useState(endpoints[0]?.category ?? '');

  const curlExample = `curl -X GET "https://api.skillancer.com/v1/rates/benchmark?skill=React&experience_level=senior" \\
  -H "X-API-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json"`;

  const jsExample = `import { SkillancerIntelligence } from '@skillancer/intelligence-sdk';

const client = new SkillancerIntelligence({
  apiKey: process.env.SKILLANCER_API_KEY,
});

// Get rate benchmarks
const benchmark = await client.rates.getBenchmark({
  skill: 'React',
  experienceLevel: 'senior',
  location: 'US',
});

console.log(benchmark.data.median_rate); // e.g., 95`;

  const pythonExample = `from skillancer_intelligence import SkillancerIntelligence

client = SkillancerIntelligence(
    api_key=os.environ.get("SKILLANCER_API_KEY")
)

# Get rate benchmarks
benchmark = client.rates.get_benchmark(
    skill="React",
    experience_level="senior",
    location="US"
)

print(benchmark.data.median_rate)  # e.g., 95`;

  const responseExample = `{
  "data": {
    "skill": "React",
    "experience_level": "senior",
    "location": "US",
    "currency": "USD",
    "sample_size": 1247,
    "p10_rate": 65,
    "p25_rate": 80,
    "median_rate": 95,
    "p75_rate": 120,
    "p90_rate": 150,
    "trends": {
      "yoy_change": 0.08,
      "qoq_change": 0.02
    },
    "confidence_score": 0.92,
    "data_freshness": "2024-01-15T00:00:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link className="text-gray-500 hover:text-gray-700" href="/api-portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-semibold">API Documentation</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api-portal/dashboard">
              <Button size="sm" variant="outline">
                Dashboard
              </Button>
            </Link>
            <Link href="https://api.skillancer.com/v1/docs" target="_blank">
              <Button size="sm">OpenAPI Spec</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden min-h-[calc(100vh-65px)] w-64 border-r bg-gray-50 p-6 lg:block">
          <nav className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Getting Started
              </h3>
              <ul className="space-y-2">
                <li>
                  <a className="text-sm text-gray-700 hover:text-blue-600" href="#authentication">
                    Authentication
                  </a>
                </li>
                <li>
                  <a className="text-sm text-gray-700 hover:text-blue-600" href="#rate-limiting">
                    Rate Limiting
                  </a>
                </li>
                <li>
                  <a className="text-sm text-gray-700 hover:text-blue-600" href="#errors">
                    Error Handling
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Endpoints
              </h3>
              <ul className="space-y-2">
                {endpoints.map((cat) => (
                  <li key={cat.category}>
                    <button
                      className={`flex w-full items-center text-left text-sm ${
                        activeCategory === cat.category
                          ? 'font-medium text-blue-600'
                          : 'text-gray-700 hover:text-blue-600'
                      }`}
                      onClick={() => setActiveCategory(cat.category)}
                    >
                      <ChevronRight
                        className={`mr-1 h-4 w-4 transition-transform ${
                          activeCategory === cat.category ? 'rotate-90' : ''
                        }`}
                      />
                      {cat.category}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                SDKs
              </h3>
              <ul className="space-y-2">
                <li>
                  <a className="text-sm text-gray-700 hover:text-blue-600" href="#sdk-javascript">
                    JavaScript
                  </a>
                </li>
                <li>
                  <a className="text-sm text-gray-700 hover:text-blue-600" href="#sdk-python">
                    Python
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="max-w-4xl flex-1 p-8">
          {/* Authentication Section */}
          <section className="mb-12" id="authentication">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Authentication</h2>
            <p className="mb-4 text-gray-600">
              All API requests require authentication using an API key. Include your key in the{' '}
              <code className="rounded bg-gray-100 px-1">X-API-Key</code> header.
            </p>
            <CodeBlock code={curlExample} language="bash" />
          </section>

          {/* Quick Start */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Quick Start</h2>
            <Tabs defaultValue="javascript">
              <TabsList>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-4" value="javascript">
                <div className="mb-4">
                  <p className="mb-2 text-sm text-gray-600">Install the SDK:</p>
                  <CodeBlock code="npm install @skillancer/intelligence-sdk" language="bash" />
                </div>
                <CodeBlock code={jsExample} language="javascript" />
              </TabsContent>
              <TabsContent className="mt-4" value="python">
                <div className="mb-4">
                  <p className="mb-2 text-sm text-gray-600">Install the SDK:</p>
                  <CodeBlock code="pip install skillancer-intelligence" language="bash" />
                </div>
                <CodeBlock code={pythonExample} language="python" />
              </TabsContent>
            </Tabs>
          </section>

          {/* Example Response */}
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Example Response</h2>
            <p className="mb-4 text-gray-600">
              All responses follow a consistent structure with{' '}
              <code className="rounded bg-gray-100 px-1">data</code> and{' '}
              <code className="rounded bg-gray-100 px-1">meta</code> fields:
            </p>
            <CodeBlock code={responseExample} language="json" />
          </section>

          {/* Endpoints */}
          <section className="mb-12" id="endpoints">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Endpoints</h2>
            {endpoints.map((cat) => (
              <div
                key={cat.category}
                className={`mb-8 ${activeCategory === cat.category ? '' : 'hidden lg:block'}`}
              >
                <h3 className="mb-4 text-lg font-semibold text-gray-900">{cat.category}</h3>
                <div className="space-y-4">
                  {cat.items.map((endpoint) => (
                    <div
                      key={endpoint.path}
                      className="rounded-lg border p-4 transition-colors hover:border-blue-300"
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            endpoint.method === 'GET'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="font-mono text-sm">{endpoint.path}</code>
                      </div>
                      <p className="mb-2 text-sm text-gray-600">{endpoint.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {endpoint.params.map((param) => (
                          <span
                            key={param}
                            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
                          >
                            {param}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Rate Limiting */}
          <section className="mb-12" id="rate-limiting">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Rate Limiting</h2>
            <p className="mb-4 text-gray-600">
              Rate limits depend on your plan tier. Current limits are returned in response headers:
            </p>
            <ul className="list-inside list-disc space-y-2 text-gray-600">
              <li>
                <code className="rounded bg-gray-100 px-1">X-RateLimit-Limit</code> - Maximum
                requests per minute
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">X-RateLimit-Remaining</code> - Requests
                remaining
              </li>
              <li>
                <code className="rounded bg-gray-100 px-1">X-RateLimit-Reset</code> - UTC timestamp
                when limit resets
              </li>
            </ul>
          </section>

          {/* Error Handling */}
          <section className="mb-12" id="errors">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Error Handling</h2>
            <p className="mb-4 text-gray-600">The API uses conventional HTTP response codes:</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium text-gray-900">Code</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-900">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-2 text-gray-600">200</td>
                    <td className="px-4 py-2 text-gray-600">Success</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">400</td>
                    <td className="px-4 py-2 text-gray-600">Bad Request - Invalid parameters</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">401</td>
                    <td className="px-4 py-2 text-gray-600">
                      Unauthorized - Invalid or missing API key
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">403</td>
                    <td className="px-4 py-2 text-gray-600">
                      Forbidden - Insufficient scope or quota exceeded
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">404</td>
                    <td className="px-4 py-2 text-gray-600">Not Found - Resource not found</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">429</td>
                    <td className="px-4 py-2 text-gray-600">Rate Limited - Too many requests</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">500</td>
                    <td className="px-4 py-2 text-gray-600">Server Error - Something went wrong</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
