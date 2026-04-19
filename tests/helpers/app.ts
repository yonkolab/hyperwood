import type { FastifyInstance } from "fastify";
import { ensureTestDatabase } from "./database";
import { applyTestEnv } from "./env";

export async function buildTestApp(): Promise<FastifyInstance> {
  applyTestEnv();
  await ensureTestDatabase();

  const { buildApp } = await import("../../src/app.js");
  return buildApp();
}
