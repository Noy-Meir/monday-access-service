import { AccessRequest, RequestStatus } from '../../../models/AccessRequest';
import { IAccessRequestRepository } from './IAccessRequestRepository';

/**
 * In-memory implementation of IAccessRequestRepository.
 * All methods return shallow copies to prevent external mutation of stored state.
 * Swappable with a SQL/NoSQL implementation without changing any service code.
 */
export class InMemoryAccessRequestRepository implements IAccessRequestRepository {
  private readonly store = new Map<string, AccessRequest>();

  async save(request: AccessRequest): Promise<AccessRequest> {
    this.store.set(request.id, { ...request });
    return { ...request };
  }

  async findById(id: string): Promise<AccessRequest | null> {
    const record = this.store.get(id);
    return record ? { ...record } : null;
  }

  async findByUserId(userId: string): Promise<AccessRequest[]> {
    return Array.from(this.store.values())
      .filter((r) => r.createdBy === userId)
      .map((r) => ({ ...r }));
  }

  async findByStatus(status: RequestStatus): Promise<AccessRequest[]> {
    return Array.from(this.store.values())
      .filter((r) => r.status === status)
      .map((r) => ({ ...r }));
  }

  async findAll(): Promise<AccessRequest[]> {
    return Array.from(this.store.values()).map((r) => ({ ...r }));
  }

  async update(request: AccessRequest): Promise<AccessRequest> {
    if (!this.store.has(request.id)) {
      throw new Error(`Record ${request.id} not found`);
    }
    this.store.set(request.id, { ...request });
    return { ...request };
  }

  /** Dev/test only — bypasses the interface to pre-populate the store */
  seedMany(requests: AccessRequest[]): void {
    for (const r of requests) {
      this.store.set(r.id, { ...r });
    }
  }
}
