const testimonials = [
  {
    quote:
      "Skillancer's verification system helped me land 3x more clients. The trust score is a game-changer.",
    author: 'Sarah Chen',
    role: 'Full-Stack Developer',
    avatar: '/testimonials/sarah.jpg',
    rating: 5,
  },
  {
    quote:
      "SkillPod workspaces give me peace of mind. I know my client's code is secure and I can focus on delivery.",
    author: 'Marcus Johnson',
    role: 'DevOps Engineer',
    avatar: '/testimonials/marcus.jpg',
    rating: 5,
  },
  {
    quote:
      'SmartMatch connected me with projects I actually wanted. No more sifting through irrelevant listings.',
    author: 'Elena Rodriguez',
    role: 'UX Designer',
    avatar: '/testimonials/elena.jpg',
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Loved by Freelancers
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Join thousands of professionals who&apos;ve transformed their freelance careers.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-8"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: testimonial.rating }, (_, i) => (
                  <svg
                    key={`star-${testimonial.author}-${i}`}
                    className="h-5 w-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mb-6 leading-relaxed text-slate-700">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 font-semibold text-white">
                  {testimonial.author
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{testimonial.author}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
