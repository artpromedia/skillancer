'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import { ArrowRight, Briefcase, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function SignupPage() {
  const [role, setRole] = useState<'freelancer' | 'client' | null>(null);

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

                <form className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <input
                      className="bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="John Doe"
                      type="text"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <input
                      className="bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="john@example.com"
                      type="email"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <input
                      className="bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="••••••••"
                      type="password"
                    />
                  </div>

                  <Button className="w-full" size="lg">
                    Create Account
                  </Button>
                </form>

                <div className="mt-4">
                  <button
                    className="text-muted-foreground hover:text-primary text-sm"
                    onClick={() => setRole(null)}
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
