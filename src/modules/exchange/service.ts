import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  type ExchangeScheduleMaintenance,
  type ExchangeScheduleWindow,
  exchangeSchedules,
} from '../../db/schema/exchange';
import { AppError } from '../../lib/errors';

type UpsertExchangeScheduleInput = {
  maintenanceWindows: ExchangeScheduleMaintenance[];
  name: string;
  notes?: string;
  timezone: string;
  weeklyWindows: ExchangeScheduleWindow[];
};

export class ExchangeService {
  async getActiveSchedule() {
    const [schedule] = await db
      .select()
      .from(exchangeSchedules)
      .orderBy(desc(exchangeSchedules.updatedAt))
      .limit(1);

    if (!schedule) {
      throw new AppError(
        404,
        'exchange_schedule_not_found',
        'exchange schedule was not found',
      );
    }

    return {
      schedule: this.mapSchedule(schedule),
    };
  }

  async upsertActiveSchedule(input: UpsertExchangeScheduleInput) {
    const now = new Date();
    const [existing] = await db
      .select({
        id: exchangeSchedules.id,
      })
      .from(exchangeSchedules)
      .orderBy(desc(exchangeSchedules.updatedAt))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(exchangeSchedules)
        .values({
          name: input.name,
          timezone: input.timezone,
          weeklyWindows: input.weeklyWindows,
          maintenanceWindows: input.maintenanceWindows,
          notes: input.notes,
          updatedAt: now,
        })
        .returning();

      if (!created) {
        throw new AppError(
          500,
          'exchange_schedule_upsert_failed',
          'failed to create exchange schedule',
        );
      }

      return {
        created: true,
        schedule: this.mapSchedule(created),
      };
    }

    const [updated] = await db
      .update(exchangeSchedules)
      .set({
        name: input.name,
        timezone: input.timezone,
        weeklyWindows: input.weeklyWindows,
        maintenanceWindows: input.maintenanceWindows,
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(exchangeSchedules.id, existing.id))
      .returning();

    if (!updated) {
      throw new AppError(
        500,
        'exchange_schedule_upsert_failed',
        'failed to update exchange schedule',
      );
    }

    return {
      created: false,
      schedule: this.mapSchedule(updated),
    };
  }

  private mapSchedule(schedule: typeof exchangeSchedules.$inferSelect) {
    return {
      id: schedule.id,
      name: schedule.name,
      timezone: schedule.timezone,
      weeklyWindows: schedule.weeklyWindows,
      maintenanceWindows: schedule.maintenanceWindows,
      notes: schedule.notes,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }
}
