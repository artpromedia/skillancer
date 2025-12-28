'use client';

import { useState } from 'react';

interface NewsletterSignupProps {
  readonly variant?: 'inline' | 'card';
  readonly title?: string;
  readonly description?: string;
}

export function NewsletterSignup({
  variant = 'inline',
  title = 'Stay Updated',
  description = 'Get the latest tips, updates, and industry insights delivered to your inbox.',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    // Simulate API call
    setTimeout(() => {
      setStatus('success');
      setEmail('');
    }, 1000);
  };

  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-8">
        <h3 className="mb-2 text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mb-6 text-slate-600">{description}</p>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            disabled={status === 'loading'}
            type="submit"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
          {status === 'success' && (
            <p className="text-sm text-green-600">Thanks for subscribing!</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <form className="flex gap-3" onSubmit={handleSubmit}>
      <input
        required
        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        placeholder="Enter your email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        disabled={status === 'loading'}
        type="submit"
      >
        {status === 'loading' ? '...' : 'Subscribe'}
      </button>
    </form>
  );
}
