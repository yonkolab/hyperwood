/**
 * Return the idle-expiry timestamp for a session.
 *
 * Example:
 * `calculateSessionIdleExpiresAt(lastSeenAt, 24)`
 */
export function calculateSessionIdleExpiresAt(
  lastSeenAt: Date,
  idleTtlHours: number,
) {
  return new Date(lastSeenAt.getTime() + idleTtlHours * 60 * 60 * 1000);
}

/**
 * Return whether the session exceeded the idle timeout window.
 *
 * Example:
 * `isSessionIdleExpired(lastSeenAt, new Date(), 24)`
 */
export function isSessionIdleExpired(
  lastSeenAt: Date,
  now: Date,
  idleTtlHours: number,
) {
  return calculateSessionIdleExpiresAt(lastSeenAt, idleTtlHours) <= now;
}

/**
 * Return whether the session activity timestamp should be refreshed.
 *
 * Example:
 * `shouldTouchSessionActivity(lastSeenAt, new Date(), 60)`
 */
export function shouldTouchSessionActivity(
  lastSeenAt: Date,
  now: Date,
  minimumTouchIntervalSeconds = 60,
) {
  return (
    now.getTime() - lastSeenAt.getTime() >= minimumTouchIntervalSeconds * 1000
  );
}
