const valueProps = [
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    ),
    title: 'Secure Workspaces',
    description:
      'SkillPod provides isolated, encrypted environments for every project. Your code, your data—completely protected.',
    color: 'indigo',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    ),
    title: 'Verified Skills',
    description:
      'Our multi-layer verification system ensures every skill claim is authenticated. Trust is earned and proven.',
    color: 'emerald',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M13 10V3L4 14h7v7l9-11h-7z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    ),
    title: 'Intelligent Matching',
    description:
      'SmartMatch uses AI to connect the right talent with the right projects. Better matches, better outcomes.',
    color: 'purple',
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    ),
    title: 'Real-Time Analytics',
    description:
      'Cockpit gives you complete visibility into your freelance business. Track, analyze, and optimize.',
    color: 'orange',
  },
];

const colorClasses = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
};

export function ValuePropsSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Why Choose Skillancer?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            We&apos;ve reimagined freelancing from the ground up, building trust into every layer of
            the platform.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((prop) => {
            const colors = colorClasses[prop.color as keyof typeof colorClasses];
            return (
              <div
                key={prop.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-lg"
              >
                <div
                  className={`h-14 w-14 rounded-xl ${colors.bg} ${colors.text} mb-5 flex items-center justify-center transition-transform group-hover:scale-110`}
                >
                  {prop.icon}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-slate-900">{prop.title}</h3>
                <p className="leading-relaxed text-slate-600">{prop.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
