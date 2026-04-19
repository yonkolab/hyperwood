import { randomUUID } from 'node:crypto';

export function buildUserCredentials() {
  const suffix = randomUUID();

  return {
    email: `user-${suffix}@example.com`,
    username: `user${suffix.replace(/-/g, '').slice(0, 12)}`,
    password: 'supersecure123',
  };
}
