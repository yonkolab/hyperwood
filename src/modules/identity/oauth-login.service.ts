import { createHash } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { env } from '../../config/env';
import { db } from '../../db/client';
import {
  mfaLoginChallenges,
  oauthLoginTransactions,
  userIdentities,
  userMfaFactors,
  users,
} from '../../db/schema';
import { createOpaqueToken, normalizeEmail, sha256Hex } from '../../lib/crypto';
import { AppError, isUniqueViolation } from '../../lib/errors';
import type { LoginAuditService } from './login-audit.service';
import type { IdentitySessionService } from './session.service';

export type OAuthProvider = 'google' | 'apple';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;

async function createRemoteJwks(provider: OAuthProvider) {
  const { createRemoteJWKSet } = await import('jose');
  return createRemoteJWKSet(
    new URL(
      provider === 'google'
        ? 'https://www.googleapis.com/oauth2/v3/certs'
        : 'https://appleid.apple.com/auth/keys',
    ),
  );
}

type RemoteJwks = Awaited<ReturnType<typeof createRemoteJwks>>;
const remoteJwks = new Map<OAuthProvider, RemoteJwks>();

type OAuthClaims = {
  subject: string;
  email: string;
};

type ProviderTokenResponse = {
  id_token?: unknown;
};

function isProviderConfigured(provider: OAuthProvider) {
  if (provider === 'google') {
    return Boolean(
      env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
  }

  return Boolean(
    env.APPLE_OAUTH_CLIENT_ID &&
      env.APPLE_OAUTH_TEAM_ID &&
      env.APPLE_OAUTH_KEY_ID &&
      env.APPLE_OAUTH_PRIVATE_KEY,
  );
}

function getProviderClientId(provider: OAuthProvider) {
  return provider === 'google'
    ? env.GOOGLE_OAUTH_CLIENT_ID
    : env.APPLE_OAUTH_CLIENT_ID;
}

function getProviderRedirectUri(provider: OAuthProvider) {
  return provider === 'google'
    ? env.GOOGLE_OAUTH_REDIRECT_URI
    : env.APPLE_OAUTH_REDIRECT_URI;
}

function getFrontendCallbackUrl(parameters: Record<string, string>) {
  const callback = new URL(env.SOCIAL_AUTH_FRONTEND_CALLBACK_URL);
  for (const [key, value] of Object.entries(parameters)) {
    callback.searchParams.set(key, value);
  }
  return callback.toString();
}

function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function getProviderErrorCode(error: unknown) {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'oauth_account_exists':
      case 'oauth_user_disabled':
      case 'oauth_state_invalid':
      case 'oauth_email_unverified':
      case 'oauth_provider_unavailable':
        return error.code;
    }
  }

  return 'oauth_authentication_failed';
}

export class OAuthLoginService {
  constructor(
    private readonly sessionService: IdentitySessionService,
    private readonly loginAuditService: LoginAuditService,
  ) {}

  getProviders() {
    return {
      providers: {
        google: isProviderConfigured('google'),
        apple: isProviderConfigured('apple'),
      },
    };
  }

  async createAuthorizationUrl(provider: OAuthProvider) {
    this.requireProvider(provider);

    const state = createOpaqueToken(32);
    const nonce = createOpaqueToken(32);
    const codeVerifier = createOpaqueToken(48);
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await db
      .delete(oauthLoginTransactions)
      .where(lt(oauthLoginTransactions.expiresAt, new Date()));
    await db.insert(oauthLoginTransactions).values({
      provider,
      stateHash: sha256Hex(state),
      nonce,
      codeVerifier,
      expiresAt,
    });

    const parameters = new URLSearchParams({
      client_id: getProviderClientId(provider),
      redirect_uri: getProviderRedirectUri(provider),
      response_type: 'code',
      scope: provider === 'google' ? 'openid email profile' : 'name email',
      state,
      nonce,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });

    if (provider === 'google') {
      parameters.set('prompt', 'select_account');
      return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
    }

    parameters.set('response_mode', 'form_post');
    return `https://appleid.apple.com/auth/authorize?${parameters}`;
  }

  async handleProviderCallback(
    provider: OAuthProvider,
    input: {
      code?: string | undefined;
      state?: string | undefined;
      error?: string | undefined;
    },
  ): Promise<string> {
    if (input.error) {
      return getFrontendCallbackUrl({ error: 'oauth_cancelled' });
    }

    if (!input.state || !input.code) {
      throw new AppError(
        400,
        'oauth_state_invalid',
        'OAuth callback is missing required parameters',
      );
    }

    const now = new Date();
    const [transaction] = await db
      .update(oauthLoginTransactions)
      .set({ consumedAt: now })
      .where(
        and(
          eq(oauthLoginTransactions.provider, provider),
          eq(oauthLoginTransactions.stateHash, sha256Hex(input.state)),
          isNull(oauthLoginTransactions.consumedAt),
          gt(oauthLoginTransactions.expiresAt, now),
        ),
      )
      .returning({
        id: oauthLoginTransactions.id,
        nonce: oauthLoginTransactions.nonce,
        codeVerifier: oauthLoginTransactions.codeVerifier,
      });

    if (!transaction) {
      throw new AppError(
        400,
        'oauth_state_invalid',
        'OAuth state is invalid, expired, or already used',
      );
    }

    this.requireProvider(provider);
    const claims = await this.exchangeAndVerifyIdentity({
      provider,
      code: input.code,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });
    const user = await this.findOrCreateProviderUser(provider, claims);
    if (user.status !== 'active') {
      throw new AppError(
        403,
        'oauth_user_disabled',
        'This account is not available for sign in',
      );
    }

    const authorizationCode = createOpaqueToken(32);
    await db
      .update(oauthLoginTransactions)
      .set({
        userId: user.id,
        authorizationCodeHash: sha256Hex(authorizationCode),
        expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_MS),
      })
      .where(eq(oauthLoginTransactions.id, transaction.id));

    const callbackUrl = getFrontendCallbackUrl({
      code: authorizationCode,
      provider,
    });

    return callbackUrl;
  }

  createFailureRedirectUrl(error: unknown) {
    return getFrontendCallbackUrl({ error: getProviderErrorCode(error) });
  }

  async exchangeAuthorizationCode(
    provider: OAuthProvider,
    authorizationCode: string,
    request: { ipAddress?: string; userAgent?: string },
  ) {
    const now = new Date();
    const [grant] = await db
      .update(oauthLoginTransactions)
      .set({ redeemedAt: now })
      .where(
        and(
          eq(oauthLoginTransactions.provider, provider),
          eq(
            oauthLoginTransactions.authorizationCodeHash,
            sha256Hex(authorizationCode),
          ),
          isNotNull(oauthLoginTransactions.userId),
          isNull(oauthLoginTransactions.redeemedAt),
          gt(oauthLoginTransactions.expiresAt, now),
        ),
      )
      .returning({ userId: oauthLoginTransactions.userId });

    if (!grant?.userId) {
      throw new AppError(
        401,
        'oauth_code_invalid',
        'OAuth login code is invalid, expired, or already used',
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, grant.userId))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new AppError(
        403,
        'oauth_user_disabled',
        'This account is not available for sign in',
      );
    }

    const activeFactors = await db
      .select({ id: userMfaFactors.id })
      .from(userMfaFactors)
      .where(
        and(
          eq(userMfaFactors.userId, user.id),
          eq(userMfaFactors.type, 'totp'),
          isNull(userMfaFactors.disabledAt),
          isNotNull(userMfaFactors.verifiedAt),
        ),
      )
      .limit(1);

    if (activeFactors[0]) {
      const challengeToken = createOpaqueToken(32);
      await db.insert(mfaLoginChallenges).values({
        userId: user.id,
        tokenHash: sha256Hex(challengeToken),
        expiresAt: new Date(
          Date.now() + env.MFA_CHALLENGE_TTL_MINUTES * 60 * 1000,
        ),
      });

      await this.loginAuditService.recordLoginEvent({
        userId: user.id,
        email: normalizeEmail(user.email),
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        outcome: 'mfa_challenge',
        suspicious: false,
        reason: 'oauth_login',
      });

      return {
        mfaRequired: true as const,
        challengeToken,
        user,
      };
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      ...(request.ipAddress ? { ipAddress: request.ipAddress } : {}),
      ...(request.userAgent ? { userAgent: request.userAgent } : {}),
    });

    await this.loginAuditService.recordLoginEvent({
      userId: user.id,
      email: normalizeEmail(user.email),
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      outcome: 'success',
      suspicious: false,
      reason: 'oauth_login',
    });

    return {
      mfaRequired: false as const,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user,
    };
  }

  private requireProvider(provider: OAuthProvider) {
    if (!isProviderConfigured(provider)) {
      throw new AppError(
        503,
        'oauth_provider_unavailable',
        `${provider} sign in is not configured`,
      );
    }
  }

  private async exchangeAndVerifyIdentity(input: {
    provider: OAuthProvider;
    code: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<OAuthClaims> {
    const { provider } = input;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: getProviderRedirectUri(provider),
      client_id: getProviderClientId(provider),
      code_verifier: input.codeVerifier,
    });

    if (provider === 'google') {
      body.set('client_secret', env.GOOGLE_OAUTH_CLIENT_SECRET);
    } else {
      body.set('client_secret', await this.createAppleClientSecret());
    }

    const response = await fetch(
      provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://appleid.apple.com/auth/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new AppError(
        401,
        'oauth_provider_rejected',
        'OAuth provider rejected the authorization code',
      );
    }

    const tokenResponse = (await response.json()) as ProviderTokenResponse;
    if (typeof tokenResponse.id_token !== 'string') {
      throw new AppError(
        401,
        'oauth_provider_rejected',
        'OAuth provider did not return an identity token',
      );
    }

    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(
      tokenResponse.id_token,
      await this.getRemoteJwks(provider),
      {
        issuer:
          provider === 'google'
            ? ['https://accounts.google.com', 'accounts.google.com']
            : 'https://appleid.apple.com',
        audience: getProviderClientId(provider),
        requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'email'],
        clockTolerance: 5,
      },
    );

    if (payload.nonce !== input.nonce || !payload.sub) {
      throw new AppError(
        401,
        'oauth_provider_rejected',
        'OAuth identity token failed nonce validation',
      );
    }

    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';
    if (!emailVerified || typeof payload.email !== 'string') {
      throw new AppError(
        403,
        'oauth_email_unverified',
        'Verify your email address with the identity provider first',
      );
    }

    return {
      subject: payload.sub,
      email: normalizeEmail(payload.email),
    };
  }

  private async createAppleClientSecret() {
    const { importPKCS8, SignJWT } = await import('jose');
    const privateKey = await importPKCS8(
      env.APPLE_OAUTH_PRIVATE_KEY.replace(/\\n/g, '\n'),
      'ES256',
    );

    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_OAUTH_KEY_ID })
      .setIssuer(env.APPLE_OAUTH_TEAM_ID)
      .setSubject(env.APPLE_OAUTH_CLIENT_ID)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  private async getRemoteJwks(provider: OAuthProvider) {
    const existingKeySet = remoteJwks.get(provider);
    if (existingKeySet) return existingKeySet;

    const keySet = await createRemoteJwks(provider);
    remoteJwks.set(provider, keySet);
    return keySet;
  }

  private async findOrCreateProviderUser(
    provider: OAuthProvider,
    claims: OAuthClaims,
  ) {
    const providerSubject = `${provider}:${claims.subject}`;
    const findExistingIdentity = async () => {
      const [identity] = await db
        .select({ user: users })
        .from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(
          and(
            eq(userIdentities.provider, 'oidc'),
            eq(userIdentities.providerSubject, providerSubject),
          ),
        )
        .limit(1);
      return identity?.user;
    };

    const existingUser = await findExistingIdentity();
    if (existingUser) return existingUser;

    try {
      return await db.transaction(async (tx) => {
        const [emailOwner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${claims.email}`)
          .limit(1);

        if (emailOwner) {
          throw new AppError(
            409,
            'oauth_account_exists',
            'An account already exists for this email; sign in with that account first',
          );
        }

        const [user] = await tx
          .insert(users)
          .values({ email: claims.email, status: 'active' })
          .returning();

        if (!user) {
          throw new AppError(
            500,
            'oauth_user_creation_failed',
            'Failed to create the OAuth user',
          );
        }

        await tx.insert(userIdentities).values({
          userId: user.id,
          provider: 'oidc',
          providerSubject,
          email: claims.email,
          emailVerifiedAt: new Date(),
          metadata: { provider },
        });

        return user;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (!isUniqueViolation(error)) throw error;

      const identityRaceWinner = await findExistingIdentity();
      if (identityRaceWinner) return identityRaceWinner;

      throw new AppError(
        409,
        'oauth_account_exists',
        'An account already exists for this email; sign in with that account first',
      );
    }
  }
}
