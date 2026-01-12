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

                <form className="space-y-4" onSubmit={handleSubmit}>
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
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      type="text"
                      value={fullName}
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
                      autoComplete="new-password"
                      className={inputClasses(!!errors.password)}
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
                    <p className="text-muted-foreground mt-1 text-xs">
                      8+ characters with uppercase, lowercase, and number
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
                    onClick={() => setRole(null)}
                    type="button"
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
