import { beforeEach } from "vitest";
import { resetTestDatabase } from "../helpers/database";
import { applyTestEnv } from "../helpers/env";

applyTestEnv();

beforeEach(async () => {
  await resetTestDatabase();
});
