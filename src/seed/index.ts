import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, RequestStatus, Role, User } from '../models/AccessRequest';
import { InMemoryAccessRequestRepository } from '../repositories/InMemoryAccessRequestRepository';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;

export async function seedData(
  authService: AuthService,
  repository: InMemoryAccessRequestRepository
): Promise<void> {
  logger.info('Seeding mock data...');

  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  const users: User[] = [
    { id: 'user-alice-001', email: 'alice@company.com', passwordHash, name: 'Alice Employee', role: Role.EMPLOYEE },
    { id: 'user-bob-002',   email: 'bob@company.com',   passwordHash, name: 'Bob Employee',   role: Role.EMPLOYEE },
    { id: 'user-carol-003', email: 'carol@company.com', passwordHash, name: 'Carol Approver', role: Role.APPROVER },
    { id: 'user-dave-004',  email: 'dave@company.com',  passwordHash, name: 'Dave Approver',  role: Role.APPROVER },
  ];

  users.forEach((u) => authService.registerUser(u));

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const requests: AccessRequest[] = [
    {
      id: uuidv4(),
      applicationName: 'Salesforce CRM',
      justification: 'Need access to manage enterprise accounts for the upcoming Q3 sales cycle.',
      status: RequestStatus.PENDING,
      createdBy: 'user-alice-001',
      createdByEmail: 'alice@company.com',
      createdAt: daysAgo(3),
    },
    {
      id: uuidv4(),
      applicationName: 'AWS Console',
      justification: 'Required for deploying and monitoring the new microservices pipeline.',
      status: RequestStatus.APPROVED,
      createdBy: 'user-bob-002',
      createdByEmail: 'bob@company.com',
      createdAt: daysAgo(7),
      decisionBy: 'user-carol-003',
      decisionByEmail: 'carol@company.com',
      decisionAt: daysAgo(5),
      decisionNote: 'Approved. Please complete AWS security training before first login.',
    },
    {
      id: uuidv4(),
      applicationName: 'Production Database',
      justification: 'Need read-only access to investigate a customer-reported data discrepancy.',
      status: RequestStatus.DENIED,
      createdBy: 'user-alice-001',
      createdByEmail: 'alice@company.com',
      createdAt: daysAgo(10),
      decisionBy: 'user-dave-004',
      decisionByEmail: 'dave@company.com',
      decisionAt: daysAgo(9),
      decisionNote: 'Production DB access requires VP-level approval. Please escalate through your manager.',
    },
  ];

  repository.seedMany(requests);

  logger.info('Seed complete', { usersSeeded: users.length, requestsSeeded: requests.length });
}
