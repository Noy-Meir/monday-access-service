import { apolloClient } from '../graphql/apolloClient';
import { LOGIN_MUTATION } from '../graphql/mutations';
import type { User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const { data } = await apolloClient.mutate({
      mutation: LOGIN_MUTATION,
      variables: { email, password },
    });
    return data.login;
  },
};
