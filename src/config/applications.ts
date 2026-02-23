import { Role } from '../models/AccessRequest';

export interface ApplicationDefinition {
  name: string;
  requiredApprovals: Role[];
}

export const APPLICATION_CATALOG: ApplicationDefinition[] = [
  // Tech — single IT approval
  { name: 'AWS Console',      requiredApprovals: [Role.IT] },
  { name: 'GitHub',           requiredApprovals: [Role.IT] },
  { name: 'Jira',             requiredApprovals: [Role.IT] },
  { name: 'Confluence',       requiredApprovals: [Role.IT] },
  { name: 'VPN Access',       requiredApprovals: [Role.IT] },
  { name: 'Jenkins',          requiredApprovals: [Role.IT] },

  // Tech (sensitive) — MANAGER + IT
  { name: 'Database Access',  requiredApprovals: [Role.MANAGER, Role.IT] },
  { name: 'Kubernetes',       requiredApprovals: [Role.MANAGER, Role.IT] },

  // People — HR approval
  { name: 'HiBob',            requiredApprovals: [Role.HR] },
  { name: 'Workday',          requiredApprovals: [Role.HR] },
  { name: 'BambooHR',         requiredApprovals: [Role.HR] },

  // People (sensitive) — MANAGER + HR
  { name: 'Payroll System',   requiredApprovals: [Role.MANAGER, Role.HR] },

  // Shared — IT approval
  { name: 'Slack',            requiredApprovals: [Role.IT] },
  { name: 'Zoom',             requiredApprovals: [Role.IT] },
  { name: 'Office 365',       requiredApprovals: [Role.IT] },
  { name: 'Google Workspace', requiredApprovals: [Role.IT] },
];

/** Returns the required approvals for a given app, or [ADMIN] for unknown apps. */
export function getRequiredApprovals(appName: string): Role[] {
  const entry = APPLICATION_CATALOG.find(
    (app) => app.name.toLowerCase() === appName.toLowerCase()
  );
  return entry ? entry.requiredApprovals : [Role.ADMIN];
}
