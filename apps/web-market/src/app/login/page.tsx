'use client';

import { Button, Card, CardContent } from '@skillancer/ui';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Welcome Back</h1>
            <p className="text-muted-foreground mt-2">Log in to your Skillancer account</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <form className="space-y-4">
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

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input className="rounded" type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <Link className="text-primary text-sm hover:underline" href="/forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <Button className="w-full" size="lg">
                  Log In
                </Button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">OR</span>
                <div className="bg-border h-px flex-1" />
              </div>

              <div className="space-y-3">
                <Button className="w-full" variant="outline">
                  Continue with Google
                </Button>
                <Button className="w-full" variant="outline">
                  Continue with GitHub
                </Button>
              </div>

              <p className="text-muted-foreground mt-6 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link className="text-primary hover:underline" href="/signup">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
