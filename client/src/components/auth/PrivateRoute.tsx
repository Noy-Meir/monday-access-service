import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { FullPageSpinner } from '../ui/Spinner';
import { Role } from '../../types';
import type { ReactNode } from 'react';

interface PrivateRouteProps {
  children: ReactNode;
  /** If set, the user must have one of these roles or they are redirected to /dashboard. */
  requiredRoles?: Role[];
}

export function PrivateRoute({ children, requiredRoles }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
