import Link from 'next/link';

interface CTASectionProps {
  readonly title?: string;
  readonly description?: string;
  readonly primaryCTA?: { label: string; href: string };
  readonly secondaryCTA?: { label: string; href: string };
  readonly variant?: 'gradient' | 'light' | 'dark';
}

function getSecondaryButtonClass(variant: 'gradient' | 'light' | 'dark'): string {
  if (variant === 'gradient') return 'border-white/30 text-white hover:bg-white/10';
  if (variant === 'dark') return 'border-slate-700 text-white hover:bg-slate-800';
  return 'border-slate-300 text-slate-700 hover:border-indigo-300 hover:text-indigo-600';
}

export function CTASection({
  title = 'Ready to Transform Your Freelance Career?',
  description = "Join thousands of professionals who've already made the switch. Start your free trial today.",
  primaryCTA = { label: 'Get Started Free', href: '/signup' },
  secondaryCTA = { label: 'Talk to Sales', href: '/contact' },
  variant = 'gradient',
}: CTASectionProps) {
  const bgClass = {
    gradient: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600',
    light: 'bg-slate-50',
    dark: 'bg-slate-900',
  }[variant];

  const textClass = {
    gradient: 'text-white',
    light: 'text-slate-900',
    dark: 'text-white',
  }[variant];

  const subtextClass = {
    gradient: 'text-indigo-100',
    light: 'text-slate-600',
    dark: 'text-slate-400',
  }[variant];

  return (
    <section className={`py-24 ${bgClass}`}>
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className={`text-3xl font-bold sm:text-4xl lg:text-5xl ${textClass} mb-6`}>{title}</h2>
        <p className={`text-lg sm:text-xl ${subtextClass} mx-auto mb-10 max-w-2xl`}>
          {description}
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            className={`w-full rounded-xl px-8 py-4 text-lg font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto ${
              variant === 'gradient'
                ? 'bg-white text-indigo-600 hover:bg-slate-50'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
            }`}
            href={primaryCTA.href}
          >
            {primaryCTA.label}
          </Link>
          <Link
            className={`w-full rounded-xl border-2 px-8 py-4 text-lg font-semibold transition-all sm:w-auto ${getSecondaryButtonClass(variant)}`}
            href={secondaryCTA.href}
          >
            {secondaryCTA.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
