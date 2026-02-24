'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { AdminPage } from '../../../pages/AdminPage';
import { Role } from '../../../types';
import { FullPageSpinner } from '../../../components/ui/Spinner';

const APPROVER_ROLES: Role[] = [Role.MANAGER, Role.IT, Role.HR, Role.ADMIN];

/**
 * Admin route — only accessible by non-employee roles.
 * Employees are redirected back to /dashboard.
 */
export default function AdminRoute() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !APPROVER_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) return <FullPageSpinner />;
  if (!user || !APPROVER_ROLES.includes(user.role)) return null;

  return <AdminPage />;
}
