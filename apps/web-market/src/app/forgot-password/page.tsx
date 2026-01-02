'use client';

import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

type Step = 'email' | 'sent' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStep('sent');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStep('success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'email':
        return (
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <EnvelopeIcon className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="mt-6 text-3xl font-bold text-gray-900">Forgot your password?</h1>
              <p className="mt-3 text-gray-600">
                No worries! Enter your email address and we'll send you a link to reset your
                password.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleEmailSubmit}>
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="email">
                  Email address
                </label>
                <input
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                className="w-full rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        fill="currentColor"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center">
                <Link
                  className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
                  href="/login"
                >
                  <ArrowLeftIcon className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          </div>
        );

      case 'sent':
        return (
          <div className="w-full max-w-md text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <EnvelopeIcon className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-gray-900">Check your email</h1>
            <p className="mt-3 text-gray-600">
              We've sent a password reset link to{' '}
              <span className="font-semibold text-gray-900">{email}</span>
            </p>
            <p className="mt-2 text-sm text-gray-500">The link will expire in 24 hours.</p>

            <div className="mt-8 space-y-4">
              <button
                className="w-full rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
                onClick={() => setStep('reset')}
              >
                I have the code (Demo: Continue)
              </button>

              <button
                className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
                disabled={isLoading}
                onClick={handleEmailSubmit}
              >
                {isLoading ? 'Resending...' : 'Resend Email'}
              </button>
            </div>

            <div className="mt-8 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  className="font-medium text-green-600 hover:text-green-500"
                  onClick={() => setStep('email')}
                >
                  try a different email address
                </button>
              </p>
            </div>

            <div className="mt-6">
              <Link
                className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
                href="/login"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </div>
        );

      case 'reset':
        return (
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900">Create new password</h1>
              <p className="mt-3 text-gray-600">
                Your new password must be at least 8 characters long and different from your
                previous password.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleResetSubmit}>
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  New password
                </label>
                <input
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                  id="password"
                  minLength={8}
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-sm text-gray-500">Must be at least 8 characters</p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="confirmPassword"
                >
                  Confirm new password
                </label>
                <input
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                  id="confirmPassword"
                  minLength={8}
                  name="confirmPassword"
                  placeholder="••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium">Password requirements:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                    One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                    One lowercase letter
                  </li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>One number</li>
                </ul>
              </div>

              <button
                className="w-full rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        fill="currentColor"
                      />
                    </svg>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        );

      case 'success':
        return (
          <div className="w-full max-w-md text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-gray-900">Password reset successful!</h1>
            <p className="mt-3 text-gray-600">
              Your password has been successfully reset. You can now log in with your new password.
            </p>

            <div className="mt-8">
              <Link
                className="inline-flex w-full justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
                href="/login"
              >
                Go to Login
              </Link>
            </div>

            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                For security reasons, we've logged you out of all devices. You'll need to log in
                again on each device.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center" href="/">
            <span className="text-2xl font-bold text-green-600">Skillancer</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">{renderStep()}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <Link className="hover:text-green-600" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-green-600" href="/terms">
              Terms of Service
            </Link>
            <Link className="hover:text-green-600" href="/contact">
              Contact Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
