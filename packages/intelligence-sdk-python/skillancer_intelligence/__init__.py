"""
Skillancer Intelligence SDK for Python

Official Python SDK for the Skillancer Talent Intelligence API.
Provides easy access to rate benchmarks, availability, demand signals,
and workforce planning endpoints.

Example usage:
    from skillancer_intelligence import SkillancerIntelligence

    client = SkillancerIntelligence(api_key="sk_live_your_api_key")

    benchmark = client.rates.get_benchmark(
        skill="React",
        experience_level="senior",
        location="US"
    )
    print(f"Median rate: ${benchmark.data['median_rate']}/hr")
"""

import os
import time
from typing import Any, Dict, List, Optional, TypedDict, Union
from urllib.parse import urlencode, urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


__version__ = "1.0.0"
__all__ = [
    "SkillancerIntelligence",
    "SkillancerError",
    "RatesClient",
    "AvailabilityClient",
    "DemandClient",
    "WorkforceClient",
]


# ============================================================================
# Types
# ============================================================================

class ApiMeta(TypedDict):
    request_id: str
    timestamp: str


class ApiResponse(TypedDict):
    data: Dict[str, Any]
    meta: ApiMeta


class SkillRequirement(TypedDict, total=False):
    skill: str
    count: int
    experience_level: str  # 'junior' | 'mid' | 'senior' | 'expert'
    hours_per_week: int
    priority: str  # 'critical' | 'high' | 'medium' | 'low'


# ============================================================================
# Exceptions
# ============================================================================

class SkillancerError(Exception):
    """Exception raised for API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

    def __str__(self) -> str:
        if self.status_code:
            return f"SkillancerError ({self.status_code}): {self.message}"
        return f"SkillancerError: {self.message}"


# ============================================================================
# Client Classes
# ============================================================================

class RatesClient:
    """Client for rate benchmarking endpoints."""

    def __init__(self, client: "SkillancerIntelligence"):
        self._client = client

    def get_benchmark(
        self,
        skill: str,
        experience_level: Optional[str] = None,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get rate benchmark for a skill.

        Args:
            skill: The skill to query (e.g., "React", "Python")
            experience_level: Optional filter by level ("junior", "mid", "senior", "expert")
            location: Optional filter by country code (e.g., "US", "GB")

        Returns:
            Rate benchmark data including percentiles, trends, and confidence score.
        """
        params = {"skill": skill}
        if experience_level:
            params["experience_level"] = experience_level
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/rates/benchmark", params=params)

    def compare(
        self,
        skills: List[str],
        experience_level: Optional[str] = None,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Compare rates across multiple skills.

        Args:
            skills: List of skills to compare
            experience_level: Optional filter by level
            location: Optional filter by country code

        Returns:
            Comparison data with rates for each skill.
        """
        params = {"skills": ",".join(skills)}
        if experience_level:
            params["experience_level"] = experience_level
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/rates/compare", params=params)

    def get_history(
        self,
        skill: str,
        periods: int = 12,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get historical rate trends.

        Args:
            skill: The skill to query
            periods: Number of months of history (default: 12)
            location: Optional filter by country code

        Returns:
            Historical rate data with trend analysis.
        """
        params = {"skill": skill, "periods": periods}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/rates/history", params=params)

    def by_location(
        self,
        skill: str,
        experience_level: Optional[str] = None,
    ) -> ApiResponse:
        """Get rate breakdown by location.

        Args:
            skill: The skill to query
            experience_level: Optional filter by level

        Returns:
            Rates broken down by geographic location.
        """
        params = {"skill": skill}
        if experience_level:
            params["experience_level"] = experience_level
        return self._client._request("GET", "/v1/rates/by-location", params=params)

    def by_experience(
        self,
        skill: str,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get rate breakdown by experience level.

        Args:
            skill: The skill to query
            location: Optional filter by country code

        Returns:
            Rates broken down by experience level.
        """
        params = {"skill": skill}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/rates/by-experience", params=params)


class AvailabilityClient:
    """Client for talent availability endpoints."""

    def __init__(self, client: "SkillancerIntelligence"):
        self._client = client

    def get_current(
        self,
        skill: str,
        experience_level: Optional[str] = None,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get current talent availability.

        Args:
            skill: The skill to query
            experience_level: Optional filter by level
            location: Optional filter by country code

        Returns:
            Current availability data including counts and projections.
        """
        params = {"skill": skill}
        if experience_level:
            params["experience_level"] = experience_level
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/availability/current", params=params)

    def forecast(
        self,
        skill: str,
        periods: int = 3,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Forecast future talent availability.

        Args:
            skill: The skill to query
            periods: Number of months to forecast (default: 3)
            location: Optional filter by country code

        Returns:
            Availability forecast with confidence levels.
        """
        params = {"skill": skill, "periods": periods}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/availability/forecast", params=params)

    def by_region(
        self,
        skill: str,
        experience_level: Optional[str] = None,
    ) -> ApiResponse:
        """Get availability by geographic region.

        Args:
            skill: The skill to query
            experience_level: Optional filter by level

        Returns:
            Availability broken down by region.
        """
        params = {"skill": skill}
        if experience_level:
            params["experience_level"] = experience_level
        return self._client._request("GET", "/v1/availability/by-region", params=params)

    def get_trends(
        self,
        skill: str,
        periods: int = 12,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get availability trends over time.

        Args:
            skill: The skill to query
            periods: Number of months of history (default: 12)
            location: Optional filter by country code

        Returns:
            Historical availability trends.
        """
        params = {"skill": skill, "periods": periods}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/availability/trends", params=params)

    def by_timezone(
        self,
        skill: str,
        experience_level: Optional[str] = None,
    ) -> ApiResponse:
        """Get availability by timezone distribution.

        Args:
            skill: The skill to query
            experience_level: Optional filter by level

        Returns:
            Availability broken down by timezone.
        """
        params = {"skill": skill}
        if experience_level:
            params["experience_level"] = experience_level
        return self._client._request("GET", "/v1/availability/by-timezone", params=params)


class DemandClient:
    """Client for skill demand endpoints."""

    def __init__(self, client: "SkillancerIntelligence"):
        self._client = client

    def get_current(
        self,
        skill: str,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get current demand for a skill.

        Args:
            skill: The skill to query
            location: Optional filter by country code

        Returns:
            Current demand metrics including score and competition level.
        """
        params = {"skill": skill}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/demand/current", params=params)

    def get_trends(
        self,
        skill: str,
        periods: int = 12,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get demand trends with forecast.

        Args:
            skill: The skill to query
            periods: Number of months of history (default: 12)
            location: Optional filter by country code

        Returns:
            Historical demand data with analysis and projections.
        """
        params = {"skill": skill, "periods": periods}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/demand/trends", params=params)

    def get_emerging(
        self,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> ApiResponse:
        """Get emerging high-growth skills.

        Args:
            category: Optional filter by skill category
            limit: Maximum number of results (default: 10)

        Returns:
            List of emerging skills with growth rates and drivers.
        """
        params = {"limit": limit}
        if category:
            params["category"] = category
        return self._client._request("GET", "/v1/demand/emerging", params=params)

    def get_declining(
        self,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> ApiResponse:
        """Get declining skills.

        Args:
            category: Optional filter by skill category
            limit: Maximum number of results (default: 10)

        Returns:
            List of declining skills with replacement suggestions.
        """
        params = {"limit": limit}
        if category:
            params["category"] = category
        return self._client._request("GET", "/v1/demand/declining", params=params)

    def get_correlations(
        self,
        skill: str,
        limit: int = 10,
    ) -> ApiResponse:
        """Get skill correlations.

        Args:
            skill: The skill to find correlations for
            limit: Maximum number of related skills (default: 10)

        Returns:
            Related skills with correlation scores.
        """
        params = {"skill": skill, "limit": limit}
        return self._client._request("GET", "/v1/demand/correlations", params=params)

    def by_industry(self, skill: str) -> ApiResponse:
        """Get demand by industry.

        Args:
            skill: The skill to query

        Returns:
            Demand broken down by industry vertical.
        """
        return self._client._request("GET", "/v1/demand/by-industry", params={"skill": skill})

    def get_heatmap(self, skill: str) -> ApiResponse:
        """Get demand heatmap by region.

        Args:
            skill: The skill to query

        Returns:
            Demand intensity by geographic region.
        """
        return self._client._request("GET", "/v1/demand/heatmap", params={"skill": skill})


class WorkforceClient:
    """Client for workforce planning endpoints."""

    def __init__(self, client: "SkillancerIntelligence"):
        self._client = client

    def estimate(
        self,
        skills: List[SkillRequirement],
        project_duration: int,
        start_date: str,
        location: Optional[str] = None,
        timezone: Optional[str] = None,
        budget: Optional[int] = None,
    ) -> ApiResponse:
        """Estimate team cost and timeline.

        Args:
            skills: List of skill requirements
            project_duration: Duration in months
            start_date: Desired start date (ISO 8601 format)
            location: Optional preferred location
            timezone: Optional preferred timezone
            budget: Optional budget constraint in USD

        Returns:
            Team estimate with costs, timeline, risks, and alternatives.
        """
        body = {
            "skills": skills,
            "project_duration": project_duration,
            "start_date": start_date,
        }
        if location:
            body["location"] = location
        if timezone:
            body["timezone"] = timezone
        if budget:
            body["budget"] = budget
        return self._client._request("POST", "/v1/workforce/estimate", json=body)

    def analyze_skill_gaps(
        self,
        skills: List[str],
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Analyze skill gaps in the market.

        Args:
            skills: List of skills to analyze
            location: Optional filter by country code

        Returns:
            Gap analysis with supply/demand ratios and recommendations.
        """
        params = {"skills": ",".join(skills)}
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/workforce/skill-gaps", params=params)

    def get_market_report(
        self,
        category: Optional[str] = None,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Get comprehensive market report.

        Args:
            category: Optional skill category filter
            location: Optional location filter

        Returns:
            Market report with metrics, trends, and predictions.
        """
        params = {}
        if category:
            params["category"] = category
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/workforce/market-report", params=params)

    def run_scenarios(
        self,
        skills: List[SkillRequirement],
        project_duration: int,
        start_date: str,
        location: Optional[str] = None,
        budget: Optional[int] = None,
    ) -> ApiResponse:
        """Run scenario analysis.

        Args:
            skills: List of skill requirements
            project_duration: Duration in months
            start_date: Desired start date (ISO 8601 format)
            location: Optional preferred location
            budget: Optional budget constraint in USD

        Returns:
            Multiple scenarios with probability and impact analysis.
        """
        body = {
            "skills": skills,
            "project_duration": project_duration,
            "start_date": start_date,
        }
        if location:
            body["location"] = location
        if budget:
            body["budget"] = budget
        return self._client._request("POST", "/v1/workforce/scenarios", json=body)

    def compare_options(
        self,
        skill: str,
        hours_per_week: int,
        duration_months: int,
        location: Optional[str] = None,
    ) -> ApiResponse:
        """Compare freelance vs FTE vs agency hiring options.

        Args:
            skill: The skill to compare
            hours_per_week: Weekly hours needed
            duration_months: Duration in months
            location: Optional location filter

        Returns:
            Cost and trade-off comparison for each hiring option.
        """
        params = {
            "skill": skill,
            "hours_per_week": hours_per_week,
            "duration_months": duration_months,
        }
        if location:
            params["location"] = location
        return self._client._request("GET", "/v1/workforce/compare-options", params=params)


# ============================================================================
# Main Client
# ============================================================================

class SkillancerIntelligence:
    """Skillancer Talent Intelligence API client.

    Args:
        api_key: Your API key (starts with 'sk_live_' or 'sk_test_')
        base_url: API base URL (default: https://api.skillancer.com)
        timeout: Request timeout in seconds (default: 30)
        retries: Number of retries on failure (default: 3)

    Example:
        >>> client = SkillancerIntelligence(api_key="sk_live_xxx")
        >>> benchmark = client.rates.get_benchmark(skill="React")
        >>> print(benchmark.data["median_rate"])
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.skillancer.com",
        timeout: int = 30,
        retries: int = 3,
    ):
        self.api_key = api_key or os.environ.get("SKILLANCER_API_KEY")
        if not self.api_key:
            raise SkillancerError(
                "API key is required. Pass api_key or set SKILLANCER_API_KEY environment variable."
            )

        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        # Configure session with retries
        self._session = requests.Session()
        retry_strategy = Retry(
            total=retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

        # Initialize sub-clients
        self.rates = RatesClient(self)
        self.availability = AvailabilityClient(self)
        self.demand = DemandClient(self)
        self.workforce = WorkforceClient(self)

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> ApiResponse:
        """Make an API request.

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API endpoint path
            params: Query parameters
            json: JSON body for POST requests

        Returns:
            API response data

        Raises:
            SkillancerError: If the API returns an error
        """
        url = urljoin(self.base_url, path)
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": f"skillancer-python/{__version__}",
        }

        try:
            response = self._session.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json,
                timeout=self.timeout,
            )
        except requests.exceptions.Timeout:
            raise SkillancerError("Request timed out", status_code=None)
        except requests.exceptions.RequestException as e:
            raise SkillancerError(f"Request failed: {str(e)}", status_code=None)

        if not response.ok:
            try:
                error_data = response.json()
                message = error_data.get("message", "Unknown error")
                details = error_data
            except ValueError:
                message = response.text or "Unknown error"
                details = {}

            raise SkillancerError(
                message=message,
                status_code=response.status_code,
                details=details,
            )

        return response.json()

    def close(self):
        """Close the session."""
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
