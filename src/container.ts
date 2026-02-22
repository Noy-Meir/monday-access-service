/**
 * Dependency Injection container.
 * This is the single place where all concrete classes are instantiated
 * and their dependencies wired together. Nothing else in the codebase
 * calls `new` on a service or repository.
 */
import { InMemoryAccessRequestRepository } from './repositories/InMemoryAccessRequestRepository';
import { AuthService } from './services/AuthService';
import { AuthorizationService } from './services/AuthorizationService';
import { AccessRequestService } from './services/AccessRequestService';
import { AccessRequestController } from './controllers/AccessRequestController';
import { AuthController } from './controllers/AuthController';

// ── Repositories ──────────────────────────────────────────────────────────────
const accessRequestRepository = new InMemoryAccessRequestRepository();

// ── Services ──────────────────────────────────────────────────────────────────
// AuthService owns the user Map; seedData() populates it via registerUser().
const authService = new AuthService(new Map());
const authorizationService = new AuthorizationService();
const accessRequestService = new AccessRequestService(accessRequestRepository, authorizationService);

// ── Controllers ───────────────────────────────────────────────────────────────
const accessRequestController = new AccessRequestController(accessRequestService);
const authController = new AuthController(authService);

export const container = {
  accessRequestRepository,
  authService,
  authorizationService,
  accessRequestService,
  accessRequestController,
  authController,
} as const;
