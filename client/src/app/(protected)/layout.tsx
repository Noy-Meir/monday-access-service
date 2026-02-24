'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { AppLayout } from '../../components/layout/AppLayout';
import { FullPageSpinner } from '../../components/ui/Spinner';
import type { ReactNode } from 'react';

/**
 * Auth guard for all protected routes.
 * Redirects unauthenticated visitors to /login.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <FullPageSpinner />;
  if (!user) return null;

  return <AppLayout>{children}</AppLayout>;
}
