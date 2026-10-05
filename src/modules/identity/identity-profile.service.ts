import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { AppError, isUniqueViolation } from '../../lib/errors';
import type { UpdateProfileInput } from './types';

export class IdentityProfileService {
  async updateProfile(input: UpdateProfileInput) {
    try {
      const [user] = await db
        .update(users)
        .set({
          username: input.username,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          status: users.status,
          region: users.region,
          kycStatus: users.kycStatus,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!user) {
        throw new AppError(404, 'user_not_found', 'user was not found');
      }

      return { user };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          'username_conflict',
          'username is already in use',
        );
      }

      throw error;
    }
  }
}
