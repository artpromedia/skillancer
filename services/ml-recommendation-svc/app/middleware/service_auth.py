"""
Service-to-Service Authentication Middleware
Validates that requests to /ai/* endpoints originate from authorized internal services.

Internal services authenticate via a shared service token passed in the
X-Service-Token header. This prevents frontends from calling the ML service
directly and bypassing copilot-svc's auth, rate limiting, and draft persistence.
"""

import os
import hmac
import structlog
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = structlog.get_logger()

# Paths that require service-to-service auth
PROTECTED_PREFIXES = ("/ai/",)

# Paths that are always public (health checks, OpenAPI docs)
PUBLIC_PATHS = ("/health", "/ready", "/live", "/docs", "/openapi.json", "/redoc")


class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces service-to-service authentication on /ai/* routes.

    In development (ML_SERVICE_TOKEN not set), all requests are allowed with a warning.
    In production, requests to protected paths must include a valid X-Service-Token header.
    """

    def __init__(self, app, service_token: str | None = None):
        super().__init__(app)
        self.service_token = service_token or os.environ.get("ML_SERVICE_TOKEN")

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Always allow public paths
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        # Always allow non-AI paths (recommendations, skill-gaps, trends)
        if not any(path.startswith(prefix) for prefix in PROTECTED_PREFIXES):
            return await call_next(request)

        # If no token is configured, allow all requests (development mode)
        if not self.service_token:
            logger.warning(
                "service_auth_bypassed",
                path=path,
                reason="ML_SERVICE_TOKEN not configured",
            )
            return await call_next(request)

        # Validate the service token
        provided_token = request.headers.get("x-service-token", "")

        if not provided_token:
            logger.warning(
                "service_auth_rejected",
                path=path,
                reason="missing x-service-token header",
                calling_service=request.headers.get("x-calling-service", "unknown"),
            )
            raise HTTPException(
                status_code=403,
                detail="Service authentication required. Include X-Service-Token header.",
            )

        if not hmac.compare_digest(provided_token, self.service_token):
            logger.warning(
                "service_auth_rejected",
                path=path,
                reason="invalid service token",
                calling_service=request.headers.get("x-calling-service", "unknown"),
            )
            raise HTTPException(
                status_code=403,
                detail="Invalid service token.",
            )

        # Token is valid — log the calling service for tracing
        calling_service = request.headers.get("x-calling-service", "unknown")
        logger.debug(
            "service_auth_success",
            path=path,
            calling_service=calling_service,
            request_id=request.headers.get("x-request-id"),
        )

        return await call_next(request)
