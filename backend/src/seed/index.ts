import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AccessRequest, RequestStatus, Role, User } from '../models/AccessRequest';
import { IUserRepository } from '../repositories/IUserRepository';
import { logger } from '../utils/logger';
import {IAccessRequestRepository} from "../repositories/IAccessRequestRepository";

const SALT_ROUNDS = 10;

export async function seedData(
  userRepository: IUserRepository,
  repository: IAccessRequestRepository
): Promise<void> {
  logger.info('Seeding mock data...');

  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  const users: User[] = [
    { id: 'user-alice-001',  email: 'alice@company.com', passwordHash, name: 'Alice Employee', role: Role.EMPLOYEE },
    { id: 'user-bob-002',    email: 'bob@company.com',   passwordHash, name: 'Bob Employee',   role: Role.EMPLOYEE },
    { id: 'user-carol-003',  email: 'carol@company.com', passwordHash, name: 'Carol IT',       role: Role.IT       },
    { id: 'user-dave-004',   email: 'dave@company.com',  passwordHash, name: 'Dave HR',        role: Role.HR       },
    { id: 'user-eve-005',    email: 'eve@company.com',   passwordHash, name: 'Eve Manager',    role: Role.MANAGER  },
    { id: 'user-frank-006',  email: 'frank@company.com', passwordHash, name: 'Frank Admin',    role: Role.ADMIN    },
  ];

  await Promise.all(users.map((u) => userRepository.save(u)));

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const requests: AccessRequest[] = [
    {
      id: uuidv4(),
      applicationName: 'GitHub',
      justification: 'Need access to manage code repositories for the upcoming Q3 development sprint.',
      status: RequestStatus.PENDING,
      requiredApprovals: [Role.IT],
      approvals: [],
      createdBy: 'user-alice-001',
      createdByEmail: 'alice@company.com',
      createdAt: daysAgo(3),
    },
    {
      id: uuidv4(),
      applicationName: 'AWS Console',
      justification: 'Required for deploying and monitoring the new microservices pipeline.',
      status: RequestStatus.APPROVED,
      requiredApprovals: [Role.IT],
      approvals: [
        {
          role: Role.IT,
          approvedBy: 'user-carol-003',
          approvedByEmail: 'carol@company.com',
          approvedAt: daysAgo(5),
        },
      ],
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
      applicationName: 'Database Access',
      justification: 'Need read-only access to investigate a customer-reported data discrepancy.',
      status: RequestStatus.PARTIALLY_APPROVED,
      requiredApprovals: [Role.MANAGER, Role.IT],
      approvals: [
        {
          role: Role.MANAGER,
          approvedBy: 'user-eve-005',
          approvedByEmail: 'eve@company.com',
          approvedAt: daysAgo(1),
        },
      ],
      createdBy: 'user-alice-001',
      createdByEmail: 'alice@company.com',
      createdAt: daysAgo(4),
    },
    {
      id: uuidv4(),
      applicationName: 'HiBob',
      justification: 'Need access to update employee records for the new onboarding cohort.',
      status: RequestStatus.DENIED,
      requiredApprovals: [Role.HR],
      approvals: [],
      createdBy: 'user-bob-002',
      createdByEmail: 'bob@company.com',
      createdAt: daysAgo(10),
      decisionBy: 'user-dave-004',
      decisionByEmail: 'dave@company.com',
      decisionAt: daysAgo(9),
      decisionNote: 'HR system access requires additional data-privacy training. Please re-submit after completing the training.',
    },
  ];

  await Promise.all(requests.map((r) => repository.save(r)));

  logger.info('Seed complete', { usersSeeded: users.length, requestsSeeded: requests.length });
}
