'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { fetchCurrentUserProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

export default function SignInPage() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (profile?.role === 'administrator') {
      router.replace('/dashboard');
    } else if (profile?.role === 'po_manager') {
      router.replace('/pipeline');
    }
  }, [loading, profile, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    try {
      const nextProfile = await fetchCurrentUserProfile();
      router.replace(nextProfile.role === 'administrator' ? '/dashboard' : '/pipeline');
    } catch (exc: unknown) {
      setError(exc instanceof Error ? exc.message : 'Signed in, but failed to load profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="brand-mark brand-mark-sm">P</span>
          ProcurePilot
        </Link>
      </header>

      <main className="landing-content">
        <section className="surface-card p-8 max-w-xl mx-auto w-full">
          <p className="eyebrow">Sign In</p>
          <h1 className="page-title">Access your procurement workspace</h1>
          <p className="page-subtitle">Use your seeded demo account credentials to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="field-label">Email</label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button className="button button-primary w-full" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

