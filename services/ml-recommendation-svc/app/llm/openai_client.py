"""
OpenAI Client
LLM integration for AI Work Assistant
Sprint M7: AI Work Assistant
"""

from typing import Optional, List, Dict, Any, AsyncGenerator
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
import asyncio
import httpx
import structlog

logger = structlog.get_logger()


# =============================================================================
# TYPES
# =============================================================================

class OpenAIModel(str, Enum):
    GPT4 = "gpt-4"
    GPT4_TURBO = "gpt-4-turbo-preview"
    GPT4O = "gpt-4o"
    GPT35_TURBO = "gpt-3.5-turbo"
    TEXT_EMBEDDING = "text-embedding-3-small"


class Message(BaseModel):
    """Chat message"""
    role: str  # system, user, assistant
    content: str
    name: Optional[str] = None


class CompletionRequest(BaseModel):
    """Request for completion"""
    messages: List[Message]
    model: OpenAIModel = OpenAIModel.GPT4O
    temperature: float = 0.7
    max_tokens: int = 2000
    stream: bool = False
    response_format: Optional[Dict] = None


class CompletionResponse(BaseModel):
    """Response from completion"""
    content: str
    model: str
    tokens_used: int
    prompt_tokens: int
    completion_tokens: int
    finish_reason: str
    latency_ms: int


class EmbeddingRequest(BaseModel):
    """Request for embedding"""
    texts: List[str]
    model: OpenAIModel = OpenAIModel.TEXT_EMBEDDING


class EmbeddingResponse(BaseModel):
    """Response with embeddings"""
    embeddings: List[List[float]]
    model: str
    tokens_used: int


class UsageRecord(BaseModel):
    """API usage record"""
    timestamp: datetime
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    request_type: str


# =============================================================================
# OPENAI CLIENT
# =============================================================================

class OpenAIClient:
    """
    OpenAI API client with:
    - API key management
    - Request/response handling
    - Token counting
    - Cost tracking
    - Rate limiting
    - Error retry logic
    """
    
    def __init__(
        self,
        api_key: str,
        organization_id: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
        timeout: int = 60,
        max_retries: int = 3,
    ):
        self.api_key = api_key
        self.organization_id = organization_id
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries
        
        # Usage tracking
        self.usage_records: List[UsageRecord] = []
        self.total_tokens_used = 0
        self.total_cost_usd = 0.0
        
        # Rate limiting
        self.rate_limit_remaining: Optional[int] = None
        self.rate_limit_reset: Optional[datetime] = None
        
        # HTTP client
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers=self._build_headers(),
        )
    
    def _build_headers(self) -> Dict[str, str]:
        """Build request headers."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.organization_id:
            headers["OpenAI-Organization"] = self.organization_id
        return headers
    
    # -------------------------------------------------------------------------
    # COMPLETION
    # -------------------------------------------------------------------------
    
    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """
        Generate a completion from the model.
        """
        start_time = datetime.now()
        
        payload = {
            "model": request.model.value,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        
        if request.response_format:
            payload["response_format"] = request.response_format
        
        logger.debug(
            "Sending completion request",
            model=request.model.value,
            messages=len(request.messages),
        )
        
        response = await self._request(
            "POST",
            "/chat/completions",
            json=payload,
        )
        
        # Parse response
        choice = response["choices"][0]
        usage = response["usage"]
        
        latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Track usage
        cost = self._calculate_cost(
            request.model,
            usage["prompt_tokens"],
            usage["completion_tokens"],
        )
        await self._track_usage(
            model=request.model.value,
            prompt_tokens=usage["prompt_tokens"],
            completion_tokens=usage["completion_tokens"],
            cost=cost,
            request_type="completion",
        )
        
        return CompletionResponse(
            content=choice["message"]["content"],
            model=response["model"],
            tokens_used=usage["total_tokens"],
            prompt_tokens=usage["prompt_tokens"],
            completion_tokens=usage["completion_tokens"],
            finish_reason=choice["finish_reason"],
            latency_ms=latency_ms,
        )
    
    async def complete_stream(
        self,
        request: CompletionRequest,
    ) -> AsyncGenerator[str, None]:
        """
        Stream completion tokens.
        """
        request.stream = True
        
        payload = {
            "model": request.model.value,
            "messages": [m.model_dump() for m in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
        }
        
        async with self.client.stream(
            "POST",
            f"{self.base_url}/chat/completions",
            json=payload,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    
                    import json
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})
                    
                    if "content" in delta:
                        yield delta["content"]
    
    # -------------------------------------------------------------------------
    # EMBEDDINGS
    # -------------------------------------------------------------------------
    
    async def embed(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Generate embeddings for texts.
        """
        payload = {
            "model": request.model.value,
            "input": request.texts,
        }
        
        logger.debug(
            "Sending embedding request",
            texts=len(request.texts),
        )
        
        response = await self._request(
            "POST",
            "/embeddings",
            json=payload,
        )
        
        embeddings = [d["embedding"] for d in response["data"]]
        usage = response["usage"]
        
        # Track usage
        cost = self._calculate_embedding_cost(usage["total_tokens"])
        await self._track_usage(
            model=request.model.value,
            prompt_tokens=usage["total_tokens"],
            completion_tokens=0,
            cost=cost,
            request_type="embedding",
        )
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model=response["model"],
            tokens_used=usage["total_tokens"],
        )
    
    # -------------------------------------------------------------------------
    # HTTP REQUEST HANDLING
    # -------------------------------------------------------------------------
    
    async def _request(
        self,
        method: str,
        path: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic.
        """
        url = f"{self.base_url}{path}"
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                response = await self.client.request(method, url, **kwargs)
                
                # Update rate limit info
                self._update_rate_limits(response)
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.warning(
                        "Rate limited, waiting",
                        retry_after=retry_after,
                        attempt=attempt + 1,
                    )
                    await asyncio.sleep(retry_after)
                    continue
                
                response.raise_for_status()
                return response.json()
                
            except httpx.HTTPStatusError as e:
                last_error = e
                
                if e.response.status_code in [500, 502, 503, 504]:
                    # Server error - retry with backoff
                    wait_time = 2 ** attempt
                    logger.warning(
                        "Server error, retrying",
                        status=e.response.status_code,
                        attempt=attempt + 1,
                        wait=wait_time,
                    )
                    await asyncio.sleep(wait_time)
                    continue
                
                # Client error - don't retry
                logger.error(
                    "OpenAI API error",
                    status=e.response.status_code,
                    body=e.response.text,
                )
                raise
                
            except httpx.RequestError as e:
                last_error = e
                wait_time = 2 ** attempt
                logger.warning(
                    "Request error, retrying",
                    error=str(e),
                    attempt=attempt + 1,
                    wait=wait_time,
                )
                await asyncio.sleep(wait_time)
        
        raise last_error or Exception("Max retries exceeded")
    
    def _update_rate_limits(self, response: httpx.Response):
        """Update rate limit tracking from response headers."""
        if "x-ratelimit-remaining" in response.headers:
            self.rate_limit_remaining = int(response.headers["x-ratelimit-remaining"])
        
        if "x-ratelimit-reset" in response.headers:
            self.rate_limit_reset = datetime.fromtimestamp(
                int(response.headers["x-ratelimit-reset"])
            )
    
    # -------------------------------------------------------------------------
    # COST TRACKING
    # -------------------------------------------------------------------------
    
    def _calculate_cost(
        self,
        model: OpenAIModel,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        """Calculate cost based on model pricing."""
        # Pricing per 1K tokens (as of 2024)
        pricing = {
            OpenAIModel.GPT4: {"input": 0.03, "output": 0.06},
            OpenAIModel.GPT4_TURBO: {"input": 0.01, "output": 0.03},
            OpenAIModel.GPT4O: {"input": 0.005, "output": 0.015},
            OpenAIModel.GPT35_TURBO: {"input": 0.0005, "output": 0.0015},
        }
        
        if model not in pricing:
            return 0.0
        
        rates = pricing[model]
        input_cost = (prompt_tokens / 1000) * rates["input"]
        output_cost = (completion_tokens / 1000) * rates["output"]
        
        return input_cost + output_cost
    
    def _calculate_embedding_cost(self, tokens: int) -> float:
        """Calculate embedding cost."""
        # $0.00002 per 1K tokens for text-embedding-3-small
        return (tokens / 1000) * 0.00002
    
    async def _track_usage(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost: float,
        request_type: str,
    ):
        """Track API usage."""
        record = UsageRecord(
            timestamp=datetime.now(),
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_usd=cost,
            request_type=request_type,
        )
        
        self.usage_records.append(record)
        self.total_tokens_used += record.total_tokens
        self.total_cost_usd += cost
        
        logger.debug(
            "API usage tracked",
            model=model,
            tokens=record.total_tokens,
            cost=f"${cost:.4f}",
        )
    
    # -------------------------------------------------------------------------
    # UTILITIES
    # -------------------------------------------------------------------------
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """Get usage summary."""
        return {
            "total_requests": len(self.usage_records),
            "total_tokens": self.total_tokens_used,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "by_model": self._group_usage_by_model(),
            "rate_limit_remaining": self.rate_limit_remaining,
        }
    
    def _group_usage_by_model(self) -> Dict[str, Dict]:
        """Group usage by model."""
        by_model: Dict[str, Dict] = {}
        
        for record in self.usage_records:
            if record.model not in by_model:
                by_model[record.model] = {
                    "requests": 0,
                    "tokens": 0,
                    "cost_usd": 0.0,
                }
            
            by_model[record.model]["requests"] += 1
            by_model[record.model]["tokens"] += record.total_tokens
            by_model[record.model]["cost_usd"] += record.cost_usd
        
        return by_model
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# =============================================================================
# FACTORY
# =============================================================================

def create_openai_client(
    api_key: Optional[str] = None,
    organization_id: Optional[str] = None,
) -> OpenAIClient:
    """Create OpenAI client from environment or parameters."""
    import os
    
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY not provided")
    
    org = organization_id or os.getenv("OPENAI_ORG_ID")
    
    return OpenAIClient(api_key=key, organization_id=org)
