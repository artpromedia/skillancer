"""Tests for the Skillancer Intelligence SDK."""

import os
import pytest
import responses

from skillancer_intelligence import (
    SkillancerIntelligence,
    SkillancerError,
)


class TestSkillancerIntelligence:
    """Tests for the main client class."""

    def test_init_with_api_key(self):
        """Test client initialization with API key."""
        client = SkillancerIntelligence(api_key="sk_test_123")
        assert client.api_key == "sk_test_123"
        assert client.base_url == "https://api.skillancer.com"

    def test_init_with_env_var(self, monkeypatch):
        """Test client initialization with environment variable."""
        monkeypatch.setenv("SKILLANCER_API_KEY", "sk_test_env")
        client = SkillancerIntelligence()
        assert client.api_key == "sk_test_env"

    def test_init_without_api_key_raises(self, monkeypatch):
        """Test that missing API key raises error."""
        monkeypatch.delenv("SKILLANCER_API_KEY", raising=False)
        with pytest.raises(SkillancerError) as exc:
            SkillancerIntelligence()
        assert "API key is required" in str(exc.value)

    def test_custom_base_url(self):
        """Test client with custom base URL."""
        client = SkillancerIntelligence(
            api_key="sk_test_123",
            base_url="https://custom.api.com/"
        )
        assert client.base_url == "https://custom.api.com"

    def test_context_manager(self):
        """Test client as context manager."""
        with SkillancerIntelligence(api_key="sk_test_123") as client:
            assert client.api_key == "sk_test_123"


class TestRatesClient:
    """Tests for the rates client."""

    @responses.activate
    def test_get_benchmark(self):
        """Test getting rate benchmark."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/rates/benchmark",
            json={
                "data": {
                    "skill": "React",
                    "median_rate": 95,
                    "p25_rate": 75,
                    "p75_rate": 125,
                },
                "meta": {
                    "request_id": "req_123",
                    "timestamp": "2024-01-15T10:00:00Z",
                },
            },
            status=200,
        )

        client = SkillancerIntelligence(api_key="sk_test_123")
        result = client.rates.get_benchmark(skill="React")

        assert result["data"]["skill"] == "React"
        assert result["data"]["median_rate"] == 95

    @responses.activate
    def test_compare_skills(self):
        """Test comparing skills."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/rates/compare",
            json={
                "data": {
                    "skills": [
                        {"skill": "React", "median_rate": 95},
                        {"skill": "Vue", "median_rate": 85},
                    ],
                },
                "meta": {"request_id": "req_123", "timestamp": "2024-01-15T10:00:00Z"},
            },
            status=200,
        )

        client = SkillancerIntelligence(api_key="sk_test_123")
        result = client.rates.compare(skills=["React", "Vue"])

        assert len(result["data"]["skills"]) == 2


class TestAvailabilityClient:
    """Tests for the availability client."""

    @responses.activate
    def test_get_current(self):
        """Test getting current availability."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/availability/current",
            json={
                "data": {
                    "skill": "React",
                    "available_count": 1500,
                    "availability_score": 0.75,
                },
                "meta": {"request_id": "req_123", "timestamp": "2024-01-15T10:00:00Z"},
            },
            status=200,
        )

        client = SkillancerIntelligence(api_key="sk_test_123")
        result = client.availability.get_current(skill="React")

        assert result["data"]["available_count"] == 1500


class TestDemandClient:
    """Tests for the demand client."""

    @responses.activate
    def test_get_emerging(self):
        """Test getting emerging skills."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/demand/emerging",
            json={
                "data": {
                    "skills": [
                        {"skill": "Rust", "growth_rate": 45.5},
                        {"skill": "Go", "growth_rate": 32.1},
                    ],
                },
                "meta": {"request_id": "req_123", "timestamp": "2024-01-15T10:00:00Z"},
            },
            status=200,
        )

        client = SkillancerIntelligence(api_key="sk_test_123")
        result = client.demand.get_emerging(limit=5)

        assert len(result["data"]["skills"]) == 2


class TestWorkforceClient:
    """Tests for the workforce client."""

    @responses.activate
    def test_estimate_team(self):
        """Test team cost estimation."""
        responses.add(
            responses.POST,
            "https://api.skillancer.com/v1/workforce/estimate",
            json={
                "data": {
                    "estimated_cost": 150000,
                    "estimated_time_to_hire": 4,
                },
                "meta": {"request_id": "req_123", "timestamp": "2024-01-15T10:00:00Z"},
            },
            status=200,
        )

        client = SkillancerIntelligence(api_key="sk_test_123")
        result = client.workforce.estimate(
            skills=[{"skill": "React", "count": 2, "experience_level": "senior"}],
            project_duration=6,
            start_date="2024-02-01",
        )

        assert result["data"]["estimated_cost"] == 150000


class TestErrorHandling:
    """Tests for error handling."""

    @responses.activate
    def test_unauthorized_error(self):
        """Test handling of 401 error."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/rates/benchmark",
            json={"message": "Invalid API key"},
            status=401,
        )

        client = SkillancerIntelligence(api_key="sk_invalid")
        with pytest.raises(SkillancerError) as exc:
            client.rates.get_benchmark(skill="React")

        assert exc.value.status_code == 401
        assert "Invalid API key" in exc.value.message

    @responses.activate
    def test_rate_limit_error(self):
        """Test handling of rate limit error."""
        responses.add(
            responses.GET,
            "https://api.skillancer.com/v1/rates/benchmark",
            json={"message": "Rate limit exceeded"},
            status=429,
        )

        client = SkillancerIntelligence(api_key="sk_test_123", retries=0)
        with pytest.raises(SkillancerError) as exc:
            client.rates.get_benchmark(skill="React")

        assert exc.value.status_code == 429
