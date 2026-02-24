import { User } from '../models/AccessRequest';
import { IUserRepository } from './IUserRepository';

/**
 * In-memory implementation of IUserRepository.
 * Returns shallow copies so callers cannot mutate stored state.
 * Swappable with a SQL/NoSQL implementation without changing AuthService.
 */
export class InMemoryUserRepository implements IUserRepository {
  private readonly store = new Map<string, User>();

  async findById(id: string): Promise<User | undefined> {
    const record = this.store.get(id);
    return record ? { ...record } : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const record = Array.from(this.store.values()).find((u) => u.email === email);
    return record ? { ...record } : undefined;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, { ...user });
  }
}
