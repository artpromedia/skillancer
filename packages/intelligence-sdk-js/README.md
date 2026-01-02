# Skillancer Intelligence SDK for JavaScript/TypeScript

Official JavaScript/TypeScript SDK for the [Skillancer Talent Intelligence API](https://skillancer.com/api-portal).

## Installation

```bash
npm install @skillancer/intelligence-sdk
# or
yarn add @skillancer/intelligence-sdk
# or
pnpm add @skillancer/intelligence-sdk
```

## Quick Start

```typescript
import { SkillancerIntelligence } from '@skillancer/intelligence-sdk';

const client = new SkillancerIntelligence({
  apiKey: process.env.SKILLANCER_API_KEY!,
});

// Get rate benchmarks for React developers
const benchmark = await client.rates.getBenchmark({
  skill: 'React',
  experienceLevel: 'senior',
  location: 'US',
});

console.log(`Median rate: $${benchmark.data.median_rate}/hr`);
console.log(`Sample size: ${benchmark.data.sample_size} freelancers`);
```

## API Reference

### Rates

```typescript
// Get rate benchmark for a skill
const benchmark = await client.rates.getBenchmark({
  skill: 'Python',
  experienceLevel: 'senior', // optional: 'junior' | 'mid' | 'senior' | 'expert'
  location: 'US', // optional: country code
});

// Compare rates across multiple skills
const comparison = await client.rates.compare({
  skills: ['React', 'Vue.js', 'Angular'],
  experienceLevel: 'mid',
});

// Get historical rate trends
const history = await client.rates.getHistory({
  skill: 'TypeScript',
  periods: 12, // months
});

// Get rates by location
const byLocation = await client.rates.byLocation({
  skill: 'Node.js',
});

// Get rates by experience level
const byExperience = await client.rates.byExperience({
  skill: 'AWS',
});
```

### Availability

```typescript
// Get current talent availability
const availability = await client.availability.getCurrent({
  skill: 'Kubernetes',
  experienceLevel: 'senior',
});

// Forecast future availability
const forecast = await client.availability.forecast({
  skill: 'Machine Learning',
  periods: 3, // months to forecast
});

// Get availability by region
const byRegion = await client.availability.byRegion({
  skill: 'React',
});

// Get availability by timezone
const byTimezone = await client.availability.byTimezone({
  skill: 'Python',
});
```

### Demand

```typescript
// Get current demand for a skill
const demand = await client.demand.getCurrent({
  skill: 'Go',
});

// Get demand trends with forecast
const trends = await client.demand.getTrends({
  skill: 'Rust',
  periods: 12,
});

// Get emerging skills
const emerging = await client.demand.getEmerging({
  category: 'AI/ML',
  limit: 10,
});

// Get declining skills
const declining = await client.demand.getDeclining();

// Get skill correlations
const correlations = await client.demand.getCorrelations({
  skill: 'React',
  limit: 10,
});

// Get demand by industry
const byIndustry = await client.demand.byIndustry({
  skill: 'Python',
});

// Get demand heatmap
const heatmap = await client.demand.getHeatmap({
  skill: 'TypeScript',
});
```

### Workforce Planning

```typescript
// Estimate team cost and timeline
const estimate = await client.workforce.estimate({
  skills: [
    { skill: 'React', count: 2, experience_level: 'senior', hours_per_week: 40 },
    { skill: 'Node.js', count: 1, experience_level: 'mid', hours_per_week: 40 },
    { skill: 'DevOps', count: 1, experience_level: 'senior', hours_per_week: 20 },
  ],
  projectDuration: 6, // months
  startDate: '2024-02-01T00:00:00Z',
  budget: 150000, // optional
});

console.log(`Total cost: $${estimate.data.total_cost}`);
console.log(`Monthly burn: $${estimate.data.monthly_burn}`);

// Analyze skill gaps
const gaps = await client.workforce.analyzeSkillGaps({
  skills: ['React', 'TypeScript', 'GraphQL'],
});

// Get market report
const report = await client.workforce.getMarketReport({
  category: 'Engineering',
});

// Run scenario analysis
const scenarios = await client.workforce.runScenarios({
  skills: [{ skill: 'Python', count: 3, experience_level: 'senior', hours_per_week: 40 }],
  projectDuration: 12,
  startDate: '2024-03-01T00:00:00Z',
});

// Compare hiring options (freelance vs FTE vs agency)
const options = await client.workforce.compareOptions({
  skill: 'React',
  hoursPerWeek: 40,
  durationMonths: 12,
});
```

## Error Handling

```typescript
import { SkillancerIntelligence, SkillancerError } from '@skillancer/intelligence-sdk';

try {
  const benchmark = await client.rates.getBenchmark({ skill: 'React' });
} catch (error) {
  if (error instanceof SkillancerError) {
    console.error(`API Error (${error.statusCode}): ${error.message}`);
    console.error('Details:', error.details);
  } else {
    throw error;
  }
}
```

## Configuration

```typescript
const client = new SkillancerIntelligence({
  apiKey: 'sk_live_your_api_key',
  baseUrl: 'https://api.skillancer.com', // optional, for custom deployments
  timeout: 30000, // optional, request timeout in ms
  retries: 3, // optional, number of retries on failure
});
```

## Request Cancellation

```typescript
const controller = new AbortController();

// Start the request
const promise = client.rates.getBenchmark({ skill: 'React' }, { signal: controller.signal });

// Cancel it if needed
controller.abort();
```

## TypeScript Support

This SDK is written in TypeScript and includes full type definitions. All response types are fully typed:

```typescript
import type {
  RateBenchmark,
  AvailabilityData,
  DemandData,
  TeamEstimate,
  EmergingSkill,
  MarketReport,
} from '@skillancer/intelligence-sdk';
```

## License

MIT
