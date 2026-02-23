/**
 * Maps HTTP status codes to user-friendly messages.
 * Raw backend error strings are never surfaced to the user.
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid input. Please review the form and try again.',
  401: 'Authentication failed. Please check your credentials and try again.',
  403: "You don't have permission to perform this action.",
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state of the request.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'An unexpected server error occurred. Please try again later.',
  502: 'The AI service returned an invalid response. Please try again.',
  503: 'The AI service is temporarily unavailable. Please try again later.',
};

export function getErrorMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? 'An unexpected error occurred. Please try again.';
}

/**
 * Extracts a displayable message from any thrown value.
 * Prefers the error's own message if it's already user-facing (set by the interceptor).
 */
export function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Format an ISO date string to a relative "X days ago" label,
 * falling back to a short absolute date.
 */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
