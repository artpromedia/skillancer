'use client';

/**
 * Signup Page with Form Validation
 *
 * Provides user registration with client-side validation,
 * error handling, and loading states.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: string;
  general?: string;
}

type UserRole = 'FREELANCER' | 'CLIENT';

// ============================================================================
// Validation
// ============================================================================

function validateName(name: string, field: string): string | undefined {
  if (!name.trim()) return `${field} is required`;
  if (name.trim().length < 2) return `${field} must be at least 2 characters`;
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return undefined;
}

// ============================================================================
// Component
// ============================================================================

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FREELANCER');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const firstNameError = validateName(firstName, 'First name');
    const lastNameError = validateName(lastName, 'Last name');
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (firstNameError || lastNameError || emailError || passwordError) {
      setErrors({
        firstName: firstNameError,
        lastName: lastNameError,
        email: emailError,
        password: passwordError,
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, role }),
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
    `w-full rounded-lg border px-4 py-2 focus:ring-2 ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link className="mb-8 inline-flex items-center gap-2" href="/">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                <span className="text-xl font-bold text-white">S</span>
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
            <p className="mt-2 text-slate-600">Start your free 14-day trial</p>
          </div>

          {errors.general && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">{errors.general}</div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="firstName"
                >
                  First name
                </label>
                <input
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                  aria-invalid={!!errors.firstName}
                  autoComplete="given-name"
                  className={inputClasses(!!errors.firstName)}
                  disabled={isLoading}
                  id="firstName"
                  onChange={(e) => setFirstName(e.target.value)}
                  type="text"
                  value={firstName}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600" id="firstName-error">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="lastName">
                  Last name
                </label>
                <input
                  aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                  aria-invalid={!!errors.lastName}
                  autoComplete="family-name"
                  className={inputClasses(!!errors.lastName)}
                  disabled={isLoading}
                  id="lastName"
                  onChange={(e) => setLastName(e.target.value)}
                  type="text"
                  value={lastName}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600" id="lastName-error">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                autoComplete="email"
                className={inputClasses(!!errors.email)}
                disabled={isLoading}
                id="email"
                onChange={(e) => setEmail(e.target.value)}
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
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
                autoComplete="new-password"
                className={inputClasses(!!errors.password)}
                disabled={isLoading}
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                value={password}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600" id="password-error">
                  {errors.password}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">I am a</span>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`rounded-lg border-2 px-4 py-3 font-medium transition-colors ${
                    role === 'FREELANCER'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                  disabled={isLoading}
                  onClick={() => setRole('FREELANCER')}
                  type="button"
                >
                  Freelancer
                </button>
                <button
                  className={`rounded-lg border-2 px-4 py-3 font-medium transition-colors ${
                    role === 'CLIENT'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                  disabled={isLoading}
                  onClick={() => setRole('CLIENT')}
                  type="button"
                >
                  Client
                </button>
              </div>
            </div>
            <button
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            By creating an account, you agree to our{' '}
            <Link className="text-indigo-600 hover:text-indigo-700" href="/terms">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy">
              Privacy Policy
            </Link>
          </p>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-slate-500">Or continue with</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                type="button"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="currentColor"
                  />
                </svg>
                Google
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                type="button"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link className="font-medium text-indigo-600 hover:text-indigo-700" href="/login">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Promo */}
      <div className="hidden flex-1 items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 p-12 lg:flex">
        <div className="max-w-md text-white">
          <h2 className="mb-6 text-3xl font-bold">Join 50,000+ professionals</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  fillRule="evenodd"
                />
              </svg>
              <span>Verified skill badges</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  fillRule="evenodd"
                />
              </svg>
              <span>Secure workspaces</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  fillRule="evenodd"
                />
              </svg>
              <span>AI-powered matching</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
