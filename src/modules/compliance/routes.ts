import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { IdentityService } from '../identity/service';
import { ComplianceService } from './service';

const complianceProfileBodySchema = z.object({
  countryCode: z.string().length(2),
  jurisdictionCode: z.string().min(2).max(32),
  legalEntity: z.string().min(2).max(64),
  kycStatus: z.enum(['pending', 'approved', 'rejected', 'restricted']),
  sanctionsStatus: z.enum(['clear', 'pending_review', 'restricted']),
  kycProvider: z.string().min(1).max(64).optional(),
  providerReference: z.string().min(1).max(255).optional(),
  ageVerified: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const restrictionBodySchema = z.object({
  scope: z.enum(['all', 'trading', 'funding', 'withdrawal']),
  reason: z.string().min(3),
  source: z.enum(['system', 'provider', 'admin']),
  expiresAt: z.string().datetime().optional(),
});

const complianceUserParamsSchema = z.object({
  userId: z.string().uuid(),
});

function getSessionTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'missing_session', 'missing bearer session token');
  }

  return header.slice('Bearer '.length);
}

function assertBootstrapToken(request: FastifyRequest) {
  const bootstrapToken = request.headers['x-bootstrap-token'];

  if (bootstrapToken !== env.INTERNAL_BOOTSTRAP_TOKEN) {
    throw new AppError(
      401,
      'invalid_bootstrap_token',
      'invalid bootstrap token',
    );
  }
}

async function complianceRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const complianceService = new ComplianceService();

  app.get('/compliance/me/capabilities', async (request) => {
    const sessionToken = getSessionTokenFromRequest(request);
    const user = await identityService.getUserFromSessionToken(sessionToken);

    return complianceService.getCapabilityEvaluation(user.id);
  });

  app.post(
    '/internal/compliance/users/:userId/profile',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = complianceUserParamsSchema.parse(request.params);
      const body = complianceProfileBodySchema.parse(request.body);
      const result = await complianceService.upsertComplianceProfile({
        userId: params.userId,
        countryCode: body.countryCode,
        jurisdictionCode: body.jurisdictionCode,
        legalEntity: body.legalEntity,
        kycStatus: body.kycStatus,
        sanctionsStatus: body.sanctionsStatus,
        ageVerified: body.ageVerified,
        ...(body.kycProvider ? { kycProvider: body.kycProvider } : {}),
        ...(body.providerReference
          ? { providerReference: body.providerReference }
          : {}),
        ...(body.metadata ? { metadata: body.metadata } : {}),
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/compliance/users/:userId/restrictions',
    async (request, reply) => {
      assertBootstrapToken(request);
      const params = complianceUserParamsSchema.parse(request.params);
      const body = restrictionBodySchema.parse(request.body);
      const result = await complianceService.applyAccountRestriction({
        userId: params.userId,
        scope: body.scope,
        reason: body.reason,
        source: body.source,
        ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
      });

      reply.status(201).send(result);
    },
  );
}

export async function registerComplianceRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  await complianceRoutes(app, options);
}
