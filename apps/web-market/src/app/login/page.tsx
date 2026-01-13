'use client';

/**
 * Login Page with Form Validation
 *
 * Provides email/password login with client-side validation,
 * error handling, and loading states.
 */

import { Button, Card, CardContent } from '@skillancer/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

// ============================================================================
// Validation
// ============================================================================

function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return undefined;
}

// ============================================================================
// Component
// ============================================================================

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setErrors({ general: data.message || 'Invalid email or password' });
        return;
      }

      router.push(redirectTo);
    } catch {
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Welcome Back</h1>
            <p className="text-muted-foreground mt-2">Log in to your Skillancer account</p>
          </div>

          <Card>
            <CardContent className="p-6">
              {errors.general && (
                <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
                  {errors.general}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <input
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={!!errors.email}
                    autoComplete="email"
                    className={`bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      errors.email
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:ring-primary focus:border-primary'
                    }`}
                    disabled={isLoading}
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    type="email"
                    value={email}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600" id="email-error">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <input
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    aria-invalid={!!errors.password}
                    autoComplete="current-password"
                    className={`bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      errors.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'focus:ring-primary focus:border-primary'
                    }`}
                    disabled={isLoading}
                    id="password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    value={password}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600" id="password-error">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={rememberMe}
                      className="rounded"
                      disabled={isLoading}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      type="checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  <Link className="text-primary text-sm hover:underline" href="/forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <Button className="w-full" disabled={isLoading} size="lg" type="submit">
                  {isLoading ? 'Logging in...' : 'Log In'}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">OR</span>
                <div className="bg-border h-px flex-1" />
              </div>

              <div className="space-y-3">
                <Button className="w-full" disabled={isLoading} type="button" variant="outline">
                  Continue with Google
                </Button>
                <Button className="w-full" disabled={isLoading} type="button" variant="outline">
                  Continue with GitHub
                </Button>
              </div>

              <p className="text-muted-foreground mt-6 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link className="text-primary hover:underline" href="/signup">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
