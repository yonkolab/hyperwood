import type { FastifyInstance } from "fastify";
import { buildUserCredentials } from "../fixtures/users";

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<ReturnType<typeof buildUserCredentials>> = {},
) {
  const credentials = {
    ...buildUserCredentials(),
    ...overrides,
  };

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: credentials,
  });

  return {
    credentials,
    response,
    body: response.json(),
  };
}

export async function loginUser(
  app: FastifyInstance,
  credentials: Pick<ReturnType<typeof buildUserCredentials>, "email" | "password">,
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: credentials,
  });

  return {
    response,
    body: response.json(),
  };
}

export async function createAuthenticatedSession(app: FastifyInstance) {
  const registration = await registerUser(app);

  if (registration.response.statusCode !== 201) {
    throw new Error(`expected registration to succeed, got ${registration.response.statusCode}`);
  }

  const login = await loginUser(app, registration.credentials);

  if (login.response.statusCode !== 200) {
    throw new Error(`expected login to succeed, got ${login.response.statusCode}`);
  }

  return {
    ...registration,
    sessionToken: login.body.sessionToken as string,
    loginBody: login.body,
  };
}

export async function verifyEmail(
  app: FastifyInstance,
  verificationToken: string,
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/verify-email",
    payload: {
      token: verificationToken,
    },
  });

  return {
    response,
    body: response.json(),
  };
}

export async function createVerifiedSession(app: FastifyInstance) {
  const registration = await registerUser(app);

  if (registration.response.statusCode !== 201) {
    throw new Error(`expected registration to succeed, got ${registration.response.statusCode}`);
  }

  const verification = await verifyEmail(
    app,
    registration.body.verificationChallenge.token as string,
  );

  if (verification.response.statusCode !== 200) {
    throw new Error(`expected email verification to succeed, got ${verification.response.statusCode}`);
  }

  const login = await loginUser(app, registration.credentials);

  if (login.response.statusCode !== 200) {
    throw new Error(`expected login to succeed, got ${login.response.statusCode}`);
  }

  return {
    ...registration,
    verificationBody: verification.body,
    sessionToken: login.body.sessionToken as string,
    loginBody: login.body,
  };
}
