import type { Metadata } from 'next';

import {
  HeroSection,
  ValuePropsSection,
  HowItWorksSection,
  TestimonialsSection,
  StatsSection,
  CTASection,
  SocialProof,
} from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Skillancer - The Future of Freelancing',
  description:
    'Secure workspaces, verified skills, intelligent matching. Join the platform where trust drives success.',
});

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SocialProof />
      <ValuePropsSection />
      <HowItWorksSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}
