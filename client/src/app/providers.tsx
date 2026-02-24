'use client';

import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '../graphql/apolloClient';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ToastContainer } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLogoutListener } from '../components/AuthLogoutListener';
import type { ReactNode } from 'react';

/**
 * Client-side provider tree: Apollo → Auth → Toast.
 * Wrapped in ErrorBoundary so unhandled render errors don't blank the page.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <ToastProvider>
          <AuthProvider>
            <AuthLogoutListener />
            {children}
            <ToastContainer />
          </AuthProvider>
        </ToastProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}
