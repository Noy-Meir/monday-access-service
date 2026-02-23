import { AccessRequest, RequestStatus } from '../../../models/AccessRequest';

export interface IAccessRequestRepository {
  save(request: AccessRequest): Promise<AccessRequest>;
  findById(id: string): Promise<AccessRequest | null>;
  findByUserId(userId: string): Promise<AccessRequest[]>;
  findByStatus(status: RequestStatus): Promise<AccessRequest[]>;
  findAll(): Promise<AccessRequest[]>;
  update(request: AccessRequest): Promise<AccessRequest>;
}
