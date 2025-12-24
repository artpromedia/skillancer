# @skillancer/analytics

Event tracking and user analytics infrastructure for the Skillancer platform.

## Features

- **Event Schemas**: Comprehensive event definitions for all products
- **Client SDK**: Browser and Node.js analytics client with offline support
- **Event Processing**: Kafka consumer and ClickHouse ingestion
- **Query Service**: Analytics queries with caching
- **API Endpoints**: RESTful analytics API
- **Funnel Analysis**: Configurable conversion funnels
- **Cohort Analysis**: Retention and cohort tracking
- **A/B Testing**: Experiment results calculation

## Installation

```bash
pnpm add @skillancer/analytics
```

## Quick Start

### Browser SDK

```typescript
import { initAnalytics } from '@skillancer/analytics';

const analytics = initAnalytics({
  writeKey: 'your-write-key',
  apiEndpoint: 'https://analytics.skillancer.com/v1',
  consent: {
    analytics: true,
    marketing: false,
    personalization: false,
  },
});

// Identify user
analytics.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  accountType: 'freelancer',
});

// Track page view
analytics.page('Home');

// Track events
analytics.track('button_clicked', { buttonId: 'cta-signup' });

// SkillPod events
analytics.trackCourseViewed('course-123', {
  courseTitle: 'React Mastery',
  courseCategory: 'Development',
});

// Market events
analytics.trackJobViewed('job-456', {
  jobTitle: 'Senior Developer',
  budgetType: 'hourly',
});
```

### React Hook

```typescript
import { useAnalytics } from '@skillancer/analytics';

function MyComponent() {
  const analytics = useAnalytics();

  const handleClick = () => {
    analytics.track('feature_used', { featureName: 'search' });
  };

  return <button onClick={handleClick}>Search</button>;
}
```

## Event Types

### Base Events

- `page_view` - Page/screen views
- `identify` - User identification
- `track` - Custom events

### SkillPod Events

- `course_viewed`, `course_enrolled`, `course_completed`
- `lesson_started`, `lesson_completed`
- `video_play`, `video_pause`, `video_complete`
- `assessment_submitted`, `assessment_passed`

### Market Events

- `job_viewed`, `job_saved`
- `proposal_submitted`, `proposal_accepted`
- `contract_created`, `contract_completed`
- `search_performed`

### Conversion Events

- `signup_started`, `signup_completed`
- `onboarding_step_completed`
- `subscription_started`, `subscription_upgraded`

## API Endpoints

| Endpoint                               | Description       |
| -------------------------------------- | ----------------- |
| `GET /api/analytics/realtime`          | Real-time metrics |
| `GET /api/analytics/users/:userId`     | User analytics    |
| `GET /api/analytics/funnels/:name`     | Funnel analysis   |
| `GET /api/analytics/cohorts/retention` | Cohort retention  |
| `GET /api/analytics/segments`          | User segments     |
| `GET /api/analytics/experiments/:id`   | A/B test results  |

## Privacy & Consent

The SDK respects user consent preferences:

```typescript
analytics.setConsent({
  analytics: true, // Required for event tracking
  marketing: false, // For marketing attribution
  personalization: false, // For personalized content
});
```

Events are blocked if `analytics: false`.

## Architecture

```
Browser/App → Analytics SDK → API Gateway → Kafka → Event Processor → ClickHouse
                                                            ↓
                                                    Query Service → API
```
