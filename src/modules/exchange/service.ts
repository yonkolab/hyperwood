import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  type ExchangeScheduleMaintenance,
  type ExchangeScheduleWindow,
  exchangeFeeSchedules,
  exchangeSchedules,
} from '../../db/schema/exchange';
import type { marketCurrencyEnum } from '../../db/schema/markets';
import { AppError } from '../../lib/errors';
import { AdminAuditService } from '../operations/audit';

type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
type MarketCurrency = (typeof marketCurrencyEnum.enumValues)[number];
type ExchangeStatus = 'open' | 'closed' | 'maintenance';
type ExchangeStatusReason =
  | 'within_scheduled_hours'
  | 'outside_scheduled_hours'
  | 'maintenance_window';

type UpsertExchangeScheduleInput = {
  maintenanceWindows: ExchangeScheduleMaintenance[];
  name: string;
  notes?: string;
  timezone: string;
  weeklyWindows: ExchangeScheduleWindow[];
};

type PublishExchangeFeeScheduleInput = {
  currency: MarketCurrency;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  makerFeeBps: number;
  name: string;
  notes?: string;
  publishedBy?: string;
  takerFeeBps: number;
};

export class ExchangeService {
  private readonly adminAuditService = new AdminAuditService();

  async getActiveSchedule() {
    const schedule = await this.loadActiveSchedule();

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

  async getCurrentExchangeStatus(input: { at?: Date } = {}) {
    const at = input.at ?? new Date();
    const schedule = await this.loadActiveSchedule();
    const derived = this.deriveExchangeStatus(schedule, at);

    return {
      asOf: at.toISOString(),
      status: derived.status,
      reason: derived.reason,
      tradingAllowed: derived.status === 'open',
      localDate: derived.localDate,
      localTime: derived.localTime,
      activeWindow: derived.activeWindow,
      activeMaintenanceWindow: derived.activeMaintenanceWindow,
      schedule: this.mapSchedule(schedule),
    };
  }

  async assertTradingOpen(executor: DbExecutor = db, at: Date = new Date()) {
    const schedule = await this.loadActiveSchedule(executor);
    const derived = this.deriveExchangeStatus(schedule, at);

    if (derived.status === 'open') {
      return derived;
    }

    throw new AppError(
      409,
      'exchange_not_open',
      derived.status === 'maintenance'
        ? 'exchange is under scheduled maintenance'
        : 'exchange is outside scheduled trading hours',
    );
  }

  async listActiveFeeSchedules(input: { currency?: MarketCurrency } = {}) {
    const now = new Date();
    const rows = await db
      .select()
      .from(exchangeFeeSchedules)
      .where(
        and(
          input.currency
            ? eq(exchangeFeeSchedules.currency, input.currency)
            : undefined,
          lte(exchangeFeeSchedules.effectiveFrom, now),
          or(
            isNull(exchangeFeeSchedules.effectiveUntil),
            gt(exchangeFeeSchedules.effectiveUntil, now),
          ),
        ),
      )
      .orderBy(
        asc(exchangeFeeSchedules.currency),
        desc(exchangeFeeSchedules.effectiveFrom),
      );

    if (rows.length === 0) {
      throw new AppError(
        404,
        'exchange_fee_schedule_not_found',
        'exchange fee schedule was not found',
      );
    }

    return {
      asOf: now.toISOString(),
      feeSchedules: rows.map((row) => this.mapFeeSchedule(row)),
    };
  }

  async publishFeeSchedule(input: PublishExchangeFeeScheduleInput) {
    if (input.effectiveUntil && input.effectiveUntil <= input.effectiveFrom) {
      throw new AppError(
        400,
        'invalid_fee_schedule_window',
        'effective_until must be later than effective_from',
      );
    }

    return db.transaction(async (tx) => {
      const [activeSchedule] = await tx
        .select()
        .from(exchangeFeeSchedules)
        .where(
          and(
            eq(exchangeFeeSchedules.currency, input.currency),
            lte(exchangeFeeSchedules.effectiveFrom, input.effectiveFrom),
            or(
              isNull(exchangeFeeSchedules.effectiveUntil),
              gt(exchangeFeeSchedules.effectiveUntil, input.effectiveFrom),
            ),
          ),
        )
        .orderBy(desc(exchangeFeeSchedules.effectiveFrom))
        .limit(1);

      if (
        activeSchedule &&
        activeSchedule.effectiveFrom >= input.effectiveFrom
      ) {
        throw new AppError(
          409,
          'exchange_fee_schedule_overlap',
          'effective_from must be later than the current active fee schedule',
        );
      }

      if (activeSchedule) {
        await tx
          .update(exchangeFeeSchedules)
          .set({
            effectiveUntil: input.effectiveFrom,
            updatedAt: new Date(),
          })
          .where(eq(exchangeFeeSchedules.id, activeSchedule.id));
      }

      const [created] = await tx
        .insert(exchangeFeeSchedules)
        .values({
          name: input.name,
          currency: input.currency,
          makerFeeBps: input.makerFeeBps,
          takerFeeBps: input.takerFeeBps,
          effectiveFrom: input.effectiveFrom,
          effectiveUntil: input.effectiveUntil,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new AppError(
          500,
          'exchange_fee_schedule_publish_failed',
          'failed to publish exchange fee schedule',
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'exchange.fee_schedule_published',
          targetType: 'exchange_fee_schedule',
          targetId: created.id,
          ...(input.publishedBy ? { actor: input.publishedBy } : {}),
          payload: {
            currency: created.currency,
            makerFeeBps: created.makerFeeBps,
            takerFeeBps: created.takerFeeBps,
            effectiveFrom: created.effectiveFrom.toISOString(),
            effectiveUntil: created.effectiveUntil?.toISOString() ?? null,
          },
        },
        tx,
      );

      return {
        feeSchedule: this.mapFeeSchedule(created),
      };
    });
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

  private async loadActiveSchedule(executor: DbExecutor = db) {
    const [schedule] = await executor
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

    return schedule;
  }

  private deriveExchangeStatus(
    schedule: typeof exchangeSchedules.$inferSelect,
    at: Date,
  ) {
    const localContext = this.getLocalScheduleContext(at, schedule.timezone);
    const activeMaintenanceWindow =
      schedule.maintenanceWindows.find((window) => {
        const startsAt = new Date(window.startsAt);
        const endsAt = new Date(window.endsAt);

        return startsAt <= at && at < endsAt;
      }) ?? null;

    if (activeMaintenanceWindow) {
      return {
        status: 'maintenance' as const,
        reason: 'maintenance_window' as const,
        localDate: localContext.localDate,
        localTime: localContext.localTime,
        activeWindow: null,
        activeMaintenanceWindow,
      };
    }

    const activeWindow =
      schedule.weeklyWindows.find(
        (window) =>
          window.weekday === localContext.weekday &&
          window.opensAt <= localContext.localTime &&
          localContext.localTime < window.closesAt,
      ) ?? null;

    return {
      status: (activeWindow ? 'open' : 'closed') as ExchangeStatus,
      reason: (activeWindow
        ? 'within_scheduled_hours'
        : 'outside_scheduled_hours') as ExchangeStatusReason,
      localDate: localContext.localDate,
      localTime: localContext.localTime,
      activeWindow,
      activeMaintenanceWindow: null,
    };
  }

  private getLocalScheduleContext(at: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(at);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;

    if (
      !values.weekday ||
      !values.year ||
      !values.month ||
      !values.day ||
      !values.hour ||
      !values.minute
    ) {
      throw new AppError(
        500,
        'exchange_schedule_timezone_resolution_failed',
        'failed to resolve exchange schedule timezone context',
      );
    }

    return {
      weekday:
        values.weekday.toLowerCase() as ExchangeScheduleWindow['weekday'],
      localDate: `${values.year}-${values.month}-${values.day}`,
      localTime: `${values.hour}:${values.minute}`,
    };
  }

  private mapFeeSchedule(schedule: typeof exchangeFeeSchedules.$inferSelect) {
    return {
      id: schedule.id,
      name: schedule.name,
      currency: schedule.currency,
      makerFeeBps: schedule.makerFeeBps,
      takerFeeBps: schedule.takerFeeBps,
      effectiveFrom: schedule.effectiveFrom.toISOString(),
      effectiveUntil: schedule.effectiveUntil?.toISOString() ?? null,
      notes: schedule.notes,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }
}
