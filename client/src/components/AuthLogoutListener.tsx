'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

/**
 * Listens for `auth:logout` events (dispatched by the Apollo error link on 401)
 * and redirects to /login without a full page reload.
 */
export function AuthLogoutListener() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    const handler = () => {
      logout();
      router.replace('/login');
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [router, logout]);

  return null;
}
