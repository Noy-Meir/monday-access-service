import { User } from '../models/AccessRequest';

/**
 * Contract for user storage.
 * Async signatures keep the interface DB-agnostic — an in-memory Map resolves
 * immediately while a SQL/NoSQL implementation can await network I/O.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  /** Persists a user (insert or upsert by id). Used only during seeding. */
  save(user: User): Promise<void>;
}
