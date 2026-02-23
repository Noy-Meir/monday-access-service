import { api } from './api';
import type { LoginResponse, User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
    return data.data;
  },
};
