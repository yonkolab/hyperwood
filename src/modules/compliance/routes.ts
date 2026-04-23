import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getInternalAuthContext,
  getSessionAuthContext,
  requireInternalAuth,
  requireSessionAuth,
} from '../identity/auth-guards';
import { IdentityService } from '../identity/service';
import {
  complianceProfileBodySchema,
  complianceUserParamsSchema,
  restrictionBodySchema,
} from './schema';
import { ComplianceService } from './service';

async function complianceRoutes(
  app: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const identityService = new IdentityService();
  const complianceService = new ComplianceService();
  const requireSession = requireSessionAuth(identityService);
  const requireInternal = requireInternalAuth('compliance:write');

  app.get(
    '/compliance/me/capabilities',
    { preHandler: requireSession },
    async (request) => {
      const auth = getSessionAuthContext(request);

      return complianceService.getCapabilityEvaluation(auth.user.id);
    },
  );

  app.post(
    '/internal/compliance/users/:userId/profile',
    { preHandler: requireInternal },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
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
        changedBy: auth.internalActor,
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    '/internal/compliance/users/:userId/restrictions',
    { preHandler: requireInternal },
    async (request, reply) => {
      const auth = getInternalAuthContext(request);
      const params = complianceUserParamsSchema.parse(request.params);
      const body = restrictionBodySchema.parse(request.body);
      const result = await complianceService.applyAccountRestriction({
        userId: params.userId,
        scope: body.scope,
        reason: body.reason,
        source: body.source,
        ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
        changedBy: auth.internalActor,
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
