# Skillancer Intelligence SDK for Python

[![PyPI version](https://badge.fury.io/py/skillancer-intelligence.svg)](https://badge.fury.io/py/skillancer-intelligence)
[![Python Versions](https://img.shields.io/pypi/pyversions/skillancer-intelligence.svg)](https://pypi.org/project/skillancer-intelligence/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Python SDK for the Skillancer Talent Intelligence API. Access real-time freelance rate benchmarks, talent availability, skill demand signals, and workforce planning insights.

## Installation

```bash
pip install skillancer-intelligence
```

## Quick Start

```python
from skillancer_intelligence import SkillancerIntelligence

# Initialize the client
client = SkillancerIntelligence(api_key="sk_live_your_api_key")

# Get rate benchmark for a skill
benchmark = client.rates.get_benchmark(
    skill="React",
    experience_level="senior",
    location="US"
)

print(f"Median rate: ${benchmark['data']['median_rate']}/hr")
print(f"Rate range: ${benchmark['data']['p25_rate']} - ${benchmark['data']['p75_rate']}")
```

## Configuration

### Environment Variable

You can set the API key via environment variable:

```bash
export SKILLANCER_API_KEY=sk_live_your_api_key
```

```python
# Will automatically use SKILLANCER_API_KEY
client = SkillancerIntelligence()
```

### Custom Configuration

```python
client = SkillancerIntelligence(
    api_key="sk_live_xxx",
    base_url="https://api.skillancer.com",  # Custom base URL
    timeout=30,  # Request timeout in seconds
    retries=3,   # Number of retries on failure
)
```

## API Reference

### Rates Client

Get rate benchmarks, comparisons, and historical data.

```python
# Get benchmark for a skill
benchmark = client.rates.get_benchmark(
    skill="Python",
    experience_level="senior",  # junior, mid, senior, expert
    location="US"  # ISO 3166-1 alpha-2 country code
)

# Compare rates across multiple skills
comparison = client.rates.compare(
    skills=["React", "Vue", "Angular"],
    experience_level="senior"
)

# Get historical rate trends
history = client.rates.get_history(
    skill="Python",
    periods=12  # Months of history
)

# Get rates by location
by_location = client.rates.by_location(skill="React")

# Get rates by experience level
by_experience = client.rates.by_experience(skill="React")
```

### Availability Client

Access talent availability data and forecasts.

```python
# Get current availability
availability = client.availability.get_current(
    skill="React",
    experience_level="senior",
    location="US"
)

# Forecast future availability
forecast = client.availability.forecast(
    skill="React",
    periods=3  # Months to forecast
)

# Get availability by region
by_region = client.availability.by_region(skill="React")

# Get availability trends
trends = client.availability.get_trends(
    skill="React",
    periods=12
)

# Get availability by timezone
by_timezone = client.availability.by_timezone(skill="React")
```

### Demand Client

Access skill demand signals and market intelligence.

```python
# Get current demand
demand = client.demand.get_current(skill="React")

# Get demand trends with forecast
trends = client.demand.get_trends(skill="React", periods=12)

# Get emerging high-growth skills
emerging = client.demand.get_emerging(
    category="frontend",
    limit=10
)

# Get declining skills
declining = client.demand.get_declining(limit=10)

# Get skill correlations
correlations = client.demand.get_correlations(
    skill="React",
    limit=10
)

# Get demand by industry
by_industry = client.demand.by_industry(skill="React")

# Get demand heatmap by region
heatmap = client.demand.get_heatmap(skill="React")
```

### Workforce Client

Access workforce planning and cost estimation tools.

```python
# Estimate team cost and timeline
estimate = client.workforce.estimate(
    skills=[
        {
            "skill": "React",
            "count": 2,
            "experience_level": "senior",
            "hours_per_week": 40,
            "priority": "critical"
        },
        {
            "skill": "Node.js",
            "count": 1,
            "experience_level": "mid",
            "hours_per_week": 40,
            "priority": "high"
        }
    ],
    project_duration=6,  # Months
    start_date="2024-02-01",
    budget=150000
)

# Analyze skill gaps
gaps = client.workforce.analyze_skill_gaps(
    skills=["React", "TypeScript", "GraphQL"]
)

# Get market report
report = client.workforce.get_market_report(
    category="frontend",
    location="US"
)

# Run scenario analysis
scenarios = client.workforce.run_scenarios(
    skills=[{"skill": "React", "count": 2, "experience_level": "senior"}],
    project_duration=6,
    start_date="2024-02-01"
)

# Compare hiring options (freelance vs FTE vs agency)
comparison = client.workforce.compare_options(
    skill="React",
    hours_per_week=40,
    duration_months=12
)
```

## Error Handling

```python
from skillancer_intelligence import SkillancerIntelligence, SkillancerError

client = SkillancerIntelligence(api_key="sk_live_xxx")

try:
    benchmark = client.rates.get_benchmark(skill="React")
except SkillancerError as e:
    print(f"API Error: {e.message}")
    print(f"Status Code: {e.status_code}")
    print(f"Details: {e.details}")
```

### Common Error Codes

| Status Code | Description                                   |
| ----------- | --------------------------------------------- |
| 400         | Bad Request - Invalid parameters              |
| 401         | Unauthorized - Invalid or missing API key     |
| 403         | Forbidden - Insufficient scope or plan limits |
| 429         | Too Many Requests - Rate limit exceeded       |
| 500         | Internal Server Error                         |

## Context Manager

Use the client as a context manager to ensure proper cleanup:

```python
with SkillancerIntelligence(api_key="sk_live_xxx") as client:
    benchmark = client.rates.get_benchmark(skill="React")
    # Session is automatically closed after the block
```

## Response Format

All responses follow this structure:

```python
{
    "data": {
        # Actual response data
    },
    "meta": {
        "request_id": "req_abc123",
        "timestamp": "2024-01-15T10:30:00Z"
    }
}
```

## Type Hints

This library is fully typed. Enable type checking in your IDE for the best experience:

```python
from skillancer_intelligence import SkillancerIntelligence, SkillRequirement

# IDE will provide autocomplete and type checking
requirements: list[SkillRequirement] = [
    {
        "skill": "React",
        "count": 2,
        "experience_level": "senior",
        "hours_per_week": 40,
        "priority": "critical"
    }
]
```

## Async Support

For async applications, we recommend using `httpx` with the standard client:

```python
import asyncio
import httpx

async def get_benchmark():
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(
            "https://api.skillancer.com/v1/rates/benchmark",
            params={"skill": "React"},
            headers={"X-API-Key": "sk_live_xxx"}
        )
        return response.json()

# Run async function
result = asyncio.run(get_benchmark())
```

## Rate Limits

Rate limits vary by plan:

| Plan         | Requests/Month | Requests/Minute |
| ------------ | -------------- | --------------- |
| Starter      | 1,000          | 10              |
| Professional | 10,000         | 100             |
| Enterprise   | Custom         | Custom          |

The SDK automatically handles rate limit retries with exponential backoff.

## Examples

### Build a Rate Comparison Dashboard

```python
from skillancer_intelligence import SkillancerIntelligence

client = SkillancerIntelligence()

# Get rates for popular frontend skills
skills = ["React", "Vue", "Angular", "Svelte"]
comparison = client.rates.compare(skills=skills, experience_level="senior")

for skill_data in comparison["data"]["skills"]:
    print(f"{skill_data['skill']}: ${skill_data['median_rate']}/hr")
```

### Calculate Team Budget

```python
from skillancer_intelligence import SkillancerIntelligence

client = SkillancerIntelligence()

estimate = client.workforce.estimate(
    skills=[
        {"skill": "React", "count": 2, "experience_level": "senior", "hours_per_week": 40},
        {"skill": "Python", "count": 1, "experience_level": "senior", "hours_per_week": 40},
        {"skill": "DevOps", "count": 1, "experience_level": "mid", "hours_per_week": 20},
    ],
    project_duration=6,
    start_date="2024-02-01"
)

print(f"Estimated cost: ${estimate['data']['estimated_cost']:,}")
print(f"Time to hire: {estimate['data']['estimated_time_to_hire']} weeks")
```

### Track Skill Demand Trends

```python
from skillancer_intelligence import SkillancerIntelligence

client = SkillancerIntelligence()

# Get emerging skills
emerging = client.demand.get_emerging(category="ai", limit=5)

print("🚀 Emerging AI Skills:")
for skill in emerging["data"]["skills"]:
    print(f"  - {skill['skill']}: +{skill['growth_rate']}% growth")
```

## Support

- **Documentation**: https://skillancer.com/api-portal/docs
- **API Status**: https://status.skillancer.com
- **Email**: developers@skillancer.com

## License

MIT License - see [LICENSE](LICENSE) for details.
