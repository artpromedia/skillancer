const logos = [
  { name: 'TechCorp', width: 120 },
  { name: 'InnovateCo', width: 130 },
  { name: 'StartupXYZ', width: 100 },
  { name: 'DigitalFirst', width: 140 },
  { name: 'CloudNine', width: 110 },
  { name: 'DataDriven', width: 125 },
];

interface SocialProofProps {
  variant?: 'logos' | 'featured' | 'minimal';
  title?: string;
}

export function SocialProof({
  variant = 'logos',
  title = 'Trusted by leading companies',
}: SocialProofProps) {
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex -space-x-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-400"
            />
          ))}
        </div>
        <span>Join 50,000+ professionals</span>
      </div>
    );
  }

  if (variant === 'featured') {
    return (
      <div className="py-8 text-center">
        <p className="mb-6 text-sm text-slate-500">Featured in</p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {['TechCrunch', 'Forbes', 'Wired', 'The Verge'].map((name) => (
            <span key={name} className="text-xl font-bold text-slate-400">
              {name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-y border-slate-200 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm text-slate-500">{title}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex h-8 items-center justify-center text-lg font-semibold text-slate-400"
              style={{ minWidth: logo.width }}
            >
              {logo.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
