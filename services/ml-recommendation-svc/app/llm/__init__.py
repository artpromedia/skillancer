"""
LLM Module
Sprint M7: AI Work Assistant
"""

from .openai_client import (
    OpenAIClient,
    OpenAIModel,
    Message,
    CompletionRequest,
    CompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    create_openai_client,
)

__all__ = [
    "OpenAIClient",
    "OpenAIModel",
    "Message",
    "CompletionRequest",
    "CompletionResponse",
    "EmbeddingRequest",
    "EmbeddingResponse",
    "create_openai_client",
]
