import * as dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwt: {
    secret: requireEnv('JWT_SECRET', 'dev-secret-do-not-use-in-prod'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'claude',
    apiKey:   process.env.ANTHROPIC_API_KEY ?? '',
    model:    process.env.ANTHROPIC_MODEL   ?? 'claude-haiku-4-5-20251001',
  },
} as const;

export type Config = typeof config;
