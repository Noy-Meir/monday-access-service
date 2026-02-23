import axios, { AxiosError } from 'axios';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Shared Axios instance.
 *
 * Base URL:
 *  - Development: empty string → Vite proxy forwards /api/* to http://localhost:3000
 *  - Production: set VITE_API_URL to the deployed backend URL
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
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

    // On 401, clear stored credentials and let React Router redirect to /login
    if (status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Navigate without full page reload when possible
      window.dispatchEvent(new Event('auth:logout'));
    }

    // Prefer the backend's own error message; fall back to a generic one
    const backendMessage = (error.response?.data as { error?: { message?: string } })?.error?.message;
    const message = backendMessage || getErrorMessage(status);
    return Promise.reject(new Error(message));
  }
);
