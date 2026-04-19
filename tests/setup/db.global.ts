import { ensureTestDatabase, stopTestDatabase } from "../helpers/database";
import { applyTestEnv } from "../helpers/env";

export default async function setup() {
  applyTestEnv();
  await ensureTestDatabase();

  return async () => {
    await stopTestDatabase();
  };
}
