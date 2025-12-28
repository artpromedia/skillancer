'use client';

import { useEffect, useRef, useState } from 'react';

const stats = [
  { id: 'freelancers', value: 50000, suffix: '+', label: 'Verified Freelancers' },
  { id: 'satisfaction', value: 98, suffix: '%', label: 'Client Satisfaction' },
  { id: 'projects', value: 2.5, suffix: 'M+', label: 'Projects Delivered' },
  { id: 'countries', value: 150, suffix: '+', label: 'Countries' },
];

function StatItem({
  value,
  suffix,
  label,
  isVisible,
}: {
  readonly value: number;
  readonly suffix: string;
  readonly label: string;
  readonly isVisible: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 2000, 1);
      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, isVisible]);

  return (
    <div className="text-center">
      <div className="mb-2 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
        {count}
        {suffix}
      </div>
      <div className="text-sm text-indigo-200 sm:text-base">{label}</div>
    </div>
  );
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
          {stats.map((stat) => (
            <StatItem
              key={stat.id}
              isVisible={isVisible}
              label={stat.label}
              suffix={stat.suffix}
              value={stat.value}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
