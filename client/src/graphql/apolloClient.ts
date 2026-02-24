import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// ── HTTP link ─────────────────────────────────────────────────────────────────
const httpLink = createHttpLink({
  // In development the Next.js rewrite in next.config.ts proxies /graphql to the backend.
  // In production set NEXT_PUBLIC_API_URL to the deployed backend base URL.
  uri: `${process.env.NEXT_PUBLIC_API_URL ?? ''}/graphql`,
});

// ── Auth link: attach JWT from localStorage ───────────────────────────────────
const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// ── Error link: handle auth failures ─────────────────────────────────────────
const errorLink = onError(({ graphQLErrors, networkError }) => {
  const isUnauthenticated =
    graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') ||
    (networkError && 'statusCode' in networkError && networkError.statusCode === 401);

  if (isUnauthenticated && typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:logout'));
  }
});

// ── Client ────────────────────────────────────────────────────────────────────
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    // Always fetch fresh data; no stale cache for mutations.
    watchQuery: { fetchPolicy: 'network-only' },
    query: { fetchPolicy: 'network-only' },
  },
});
