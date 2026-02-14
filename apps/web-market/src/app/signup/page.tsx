'use client';

/**
 * Signup Page with Form Validation
 *
 * Provides user registration with role selection,
 * client-side validation, error handling, and loading states.
 */

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import { ArrowRight, Briefcase, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

type UserRole = 'freelancer' | 'client';

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  general?: string;
}

// ============================================================================
// Validation
// ============================================================================

function validateFullName(name: string): string | undefined {
  if (!name.trim()) return 'Full name is required';
  if (name.trim().length < 2) return 'Full name must be at least 2 characters';
  if (!name.includes(' ')) return 'Please enter both first and last name';
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[@$!%*?&#^()_+=\]{}|\\:";'<>,./-]/.test(password))
    return 'Password must contain at least one special character';
  return undefined;
}

// ============================================================================
// Component
// ============================================================================

export default function SignupPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const fullNameError = validateFullName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (fullNameError || emailError || passwordError) {
      setErrors({
        fullName: fullNameError,
        email: emailError,
        password: passwordError,
      });
      return;
    }

    setIsLoading(true);

    // Parse full name into first and last name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role: role?.toUpperCase(),
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setErrors({ general: data.message || 'Registration failed. Please try again.' });
        return;
      }

      router.push('/verify-email?email=' + encodeURIComponent(email));
    } catch {
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = (hasError: boolean) =>
    `bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'focus:ring-primary focus:border-primary'
    }`;

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Join Skillancer</h1>
            <p className="text-muted-foreground mt-2">Create your free account to get started</p>
          </div>

          {!role ? (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4 text-center text-sm">I want to:</p>

              <Card
                className="hover:border-primary cursor-pointer transition-colors"
                onClick={() => setRole('freelancer')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                      <User className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Find Work</h3>
                      <p className="text-muted-foreground text-sm">
                        I&apos;m a freelancer looking for opportunities
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="hover:border-primary cursor-pointer transition-colors"
                onClick={() => setRole('client')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                      <Briefcase className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Hire Talent</h3>
                      <p className="text-muted-foreground text-sm">
                        I&apos;m a client looking to hire freelancers
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <p className="text-muted-foreground mt-6 text-center text-sm">
                Already have an account?{' '}
                <Link className="text-primary hover:underline" href="/login">
                  Log in
                </Link>
              </p>

              <div className="my-6 flex items-center gap-4">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">OR</span>
                <div className="bg-border h-px flex-1" />
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/auth/oauth/google`;
                  }}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign up with Google
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/auth/oauth/github`;
                  }}
                >
                  <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  Sign up with GitHub
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/auth/oauth/facebook`;
                  }}
                >
                  <svg className="mr-2 h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Sign up with Facebook
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/auth/oauth/linkedin`;
                  }}
                >
                  <svg className="mr-2 h-5 w-5" fill="#0A66C2" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  Sign up with LinkedIn
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <Badge className="mb-4" variant="secondary">
                  {role === 'freelancer' ? 'Freelancer Account' : 'Client Account'}
                </Badge>

                {errors.general && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
                    {errors.general}
                  </div>
                )}

                <form
                  className="space-y-6"
                  onSubmit={(e) => {
                    void handleSubmit(e);
                  }}
                >
                  <div>
                    <label className="text-sm font-medium" htmlFor="fullName">
                      Full Name
                    </label>
                    <input
                      aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                      aria-invalid={!!errors.fullName}
                      autoComplete="name"
                      className={inputClasses(!!errors.fullName)}
                      disabled={isLoading}
                      id="fullName"
                      placeholder="John Doe"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-sm text-red-600" id="fullName-error">
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium" htmlFor="email">
                      Email
                    </label>
                    <input
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      aria-invalid={!!errors.email}
                      autoComplete="email"
                      className={inputClasses(!!errors.email)}
                      disabled={isLoading}
                      id="email"
                      placeholder="john@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      autoComplete="new-password"
                      className={inputClasses(!!errors.password)}
                      disabled={isLoading}
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600" id="password-error">
                        {errors.password}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      12+ characters with uppercase, lowercase, number, and special character
                    </p>
                  </div>

                  <Button className="w-full" disabled={isLoading} size="lg" type="submit">
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>

                <div className="mt-4">
                  <button
                    className="text-muted-foreground hover:text-primary text-sm"
                    disabled={isLoading}
                    type="button"
                    onClick={() => setRole(null)}
                  >
                    ← Back to role selection
                  </button>
                </div>

                <p className="text-muted-foreground mt-6 text-center text-xs">
                  By signing up, you agree to our{' '}
                  <Link className="text-primary hover:underline" href="/terms">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link className="text-primary hover:underline" href="/privacy">
                    Privacy Policy
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
