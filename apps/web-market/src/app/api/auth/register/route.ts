/**
 * POST /api/auth/register
 *
 * Next.js API route that proxies registration requests
 * to the backend auth service via the API gateway.
 */

import { NextRequest, NextResponse } from 'next/server';

// Server-side only: prefer internal K8s service URL, fall back to public API URL
const API_GATEWAY_URL =
  process.env.API_GATEWAY_INTERNAL_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://api-gateway:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_GATEWAY_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || request.ip || '',
        'user-agent': request.headers.get('user-agent') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Route] Registration proxy error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Unable to reach the registration service. Please try again later.',
        error: 'SERVICE_UNAVAILABLE',
      },
      { status: 503 }
    );
  }
}
