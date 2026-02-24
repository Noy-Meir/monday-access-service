import axios, { AxiosError } from 'axios';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Shared Axios instance.
 *
 * Base URL:
 *  - Development: empty string → Next.js rewrite forwards /api/* to the backend
 *  - Production: set NEXT_PUBLIC_API_URL to the deployed backend URL
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: normalise errors ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;

    // On 401, clear stored credentials and dispatch logout event
    if (status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:logout'));
    }

    // Prefer the backend's own error message; fall back to a generic one
    const backendMessage = (error.response?.data as { error?: { message?: string } })?.error?.message;
    const message = backendMessage || getErrorMessage(status);
    return Promise.reject(new Error(message));
  }
);
