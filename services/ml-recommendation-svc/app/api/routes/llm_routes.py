"""
LLM Proxy Routes
Internal endpoint for Node.js services to access LLM completions
through the canonical Python OpenAI client.

This keeps all LLM API keys, cost tracking, and retry logic in one place
instead of duplicating across Node.js services.

Sprint M7: AI Work Assistant — Service Delineation
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog
import time

from app.llm.openai_client import OpenAIClient

router = APIRouter(prefix="/ai/llm", tags=["LLM Proxy"])
logger = structlog.get_logger()


# =============================================================================
# REQUEST/RESPONSE SCHEMAS
# =============================================================================

class CompletionRequest(BaseModel):
    """Request for an LLM completion."""
    prompt: str = Field(..., description="The user/assistant prompt")
    system_prompt: Optional[str] = Field(
        None,
        description="System prompt for context setting"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature"
    )
    max_tokens: int = Field(
        default=2000,
        ge=1,
        le=4096,
        description="Maximum tokens in response"
    )
    model: Optional[str] = Field(
        None,
        description="Model override (defaults to service config)"
    )


class CompletionResponse(BaseModel):
    """Response from an LLM completion."""
    content: str
    model: str
    tokens_used: int
    processing_time_ms: int


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/complete", response_model=CompletionResponse)
async def complete(request: CompletionRequest) -> CompletionResponse:
    """
    Generate an LLM completion.

    This is an internal-only endpoint for service-to-service use.
    Protected by the ServiceAuthMiddleware (requires X-Service-Token).

    Use cases:
    - copilot-svc message assistance enhancement
    - copilot-svc profile summary generation
    - Any Node.js service needing LLM access without its own API keys
    """
    start_time = time.time()

    logger.info(
        "llm_completion_requested",
        model=request.model,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
        prompt_length=len(request.prompt),
    )

    try:
        client = OpenAIClient()

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        result = await client.chat_completion(
            messages=messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        processing_time = int((time.time() - start_time) * 1000)

        return CompletionResponse(
            content=result.content,
            model=result.model,
            tokens_used=result.total_tokens,
            processing_time_ms=processing_time,
        )

    except Exception as e:
        logger.error(
            "llm_completion_failed",
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"LLM completion failed: {str(e)}"
        )
