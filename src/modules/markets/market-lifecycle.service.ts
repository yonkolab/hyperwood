import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  marketEvents,
  marketStatusTransitions,
  markets,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { AdminAuditService } from '../operations/audit';
import {
  acquireMarketWriteLock,
  assertAllowedMarketStatusTransition,
  assertEventExists,
  assertNoOpenOrders,
  assertPriceSnapshot,
  mapStatusTransition,
} from './market-workflow-support';
import type {
  CreateMarketEventInput,
  CreateMarketInput,
  MarketStatus,
  UpdateMarketDetailsInput,
  UpdateMarketEventInput,
} from './types';

export class MarketLifecycleService {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  async createEvent(input: CreateMarketEventInput) {
    const insertedRows = await db
      .insert(marketEvents)
      .values({
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        category: input.category,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        updatedAt: new Date(),
      })
      .returning();

    return {
      event: insertedRows[0],
    };
  }

  async updateEvent(input: UpdateMarketEventInput) {
    const [event] = await db
      .select()
      .from(marketEvents)
      .where(eq(marketEvents.id, input.eventId))
      .limit(1);

    if (!event) {
      throw new AppError(
        404,
        'market_event_not_found',
        `market event was not found: ${input.eventId}`,
      );
    }

    const [updatedEvent] = await db.transaction(async (tx) => {
      const updatedRows = await tx
        .update(marketEvents)
        .set({
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.summary === undefined ? {} : { summary: input.summary }),
          ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
          updatedAt: new Date(),
        })
        .where(eq(marketEvents.id, event.id))
        .returning();

      await this.adminAuditService.recordEvent(
        {
          action: 'market_event.updated',
          actor: input.changedBy ?? 'bootstrap',
          targetType: 'market_event',
          targetId: event.id,
          payload: {
            title: input.title ?? event.title,
            summary:
              input.summary === undefined ? event.summary : input.summary,
            endsAt:
              input.endsAt === undefined
                ? (event.endsAt?.toISOString() ?? null)
                : (input.endsAt?.toISOString() ?? null),
          },
        },
        tx,
      );

      return updatedRows;
    });

    if (!updatedEvent) {
      throw new AppError(
        500,
        'market_event_update_failed',
        `failed to update market event ${event.id}`,
      );
    }

    return { event: updatedEvent };
  }

  async createMarket(input: CreateMarketInput) {
    await assertEventExists(input.eventId);
    assertPriceSnapshot(input.yesPriceBps, input.noPriceBps);

    return db.transaction(async (tx) => {
      const now = new Date();
      const insertedRows = await tx
        .insert(markets)
        .values({
          eventId: input.eventId,
          slug: input.slug,
          title: input.title,
          summary: input.summary,
          status: input.status,
          currency: input.currency,
          tags: input.tags ?? [],
          resolutionRules: input.resolutionRules,
          resolutionSources: input.resolutionSources ?? [],
          yesPriceBps: input.yesPriceBps,
          noPriceBps: input.noPriceBps,
          volumeUsdMinor: input.volumeUsdMinor ?? 0,
          opensAt: input.opensAt,
          closesAt: input.closesAt,
          resolvesAt: input.resolvesAt,
          statusChangedAt: now,
          updatedAt: now,
        })
        .returning();
      const market = insertedRows[0];

      if (!market) {
        throw new AppError(
          500,
          'market_creation_failed',
          'failed to create market',
        );
      }

      await tx.insert(marketStatusTransitions).values({
        marketId: market.id,
        fromStatus: null,
        toStatus: market.status,
        reason: 'market_created',
        changedBy: 'system',
      });

      return { market };
    });
  }

  async updateMarketDetails(input: UpdateMarketDetailsInput) {
    return db.transaction(async (tx) => {
      await acquireMarketWriteLock(tx, input.marketId);
      const [market] = await tx
        .select()
        .from(markets)
        .where(eq(markets.id, input.marketId))
        .limit(1);

      if (!market) {
        throw new AppError(
          404,
          'market_not_found',
          `market was not found: ${input.marketId}`,
        );
      }

      if (market.status !== 'active') {
        throw new AppError(
          409,
          'market_not_active',
          'only active markets can have their terms or reference prices updated',
        );
      }

      const yesPriceBps = input.yesPriceBps ?? market.yesPriceBps;
      const noPriceBps = input.noPriceBps ?? market.noPriceBps;
      assertPriceSnapshot(yesPriceBps, noPriceBps);

      if (
        yesPriceBps !== market.yesPriceBps ||
        noPriceBps !== market.noPriceBps
      ) {
        await assertNoOpenOrders(tx, market.id);
      }

      const closesAt =
        input.closesAt === undefined ? market.closesAt : input.closesAt;
      const resolvesAt =
        input.resolvesAt === undefined ? market.resolvesAt : input.resolvesAt;

      if (closesAt && resolvesAt && resolvesAt.getTime() < closesAt.getTime()) {
        throw new AppError(
          400,
          'invalid_closing_schedule',
          'resolvesAt must not be earlier than closesAt',
        );
      }

      const now = new Date();
      const [updatedMarket] = await tx
        .update(markets)
        .set({
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.summary === undefined ? {} : { summary: input.summary }),
          ...(input.tags === undefined ? {} : { tags: input.tags }),
          ...(input.resolutionRules === undefined
            ? {}
            : { resolutionRules: input.resolutionRules }),
          ...(input.resolutionSources === undefined
            ? {}
            : { resolutionSources: input.resolutionSources }),
          yesPriceBps,
          noPriceBps,
          closesAt,
          resolvesAt,
          updatedAt: now,
        })
        .where(eq(markets.id, market.id))
        .returning();

      if (!updatedMarket) {
        throw new AppError(
          500,
          'market_update_failed',
          `failed to update market ${market.id}`,
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'market.details_updated',
          actor: input.changedBy ?? 'bootstrap',
          targetType: 'market',
          targetId: market.id,
          payload: {
            title: input.title ?? market.title,
            yesPriceBps,
            noPriceBps,
            resolutionRules: input.resolutionRules ?? market.resolutionRules,
          },
        },
        tx,
      );

      return { market: updatedMarket };
    });
  }

  /**
   * Update the closing (and optionally resolution) schedule of one market.
   *
   * Example:
   * `await marketLifecycleService.updateMarketClosing(marketId, { closesAt: new Date('2026-10-05T02:59:59.000Z'), changedBy: 'bootstrap' })`
   */
  async updateMarketClosing(
    marketId: string,
    input: {
      closesAt: Date | null;
      resolvesAt?: Date | null;
      changedBy?: string;
    },
  ) {
    const [market] = await db
      .select()
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (!market) {
      throw new AppError(
        404,
        'market_not_found',
        `market was not found: ${marketId}`,
      );
    }

    if (
      market.status === 'settled' ||
      market.status === 'voided' ||
      market.status === 'cancelled'
    ) {
      throw new AppError(
        409,
        'market_already_archived',
        `market status ${market.status} can no longer change its closing schedule`,
      );
    }

    const resolvesAt =
      input.resolvesAt === undefined ? market.resolvesAt : input.resolvesAt;

    if (
      input.closesAt &&
      resolvesAt &&
      resolvesAt.getTime() < input.closesAt.getTime()
    ) {
      throw new AppError(
        400,
        'invalid_closing_schedule',
        'resolvesAt must not be earlier than closesAt',
      );
    }

    if (
      input.closesAt &&
      market.opensAt &&
      input.closesAt.getTime() <= market.opensAt.getTime()
    ) {
      throw new AppError(
        400,
        'invalid_closing_schedule',
        'closesAt must be later than opensAt',
      );
    }

    const now = new Date();
    const updatedRows = await db
      .update(markets)
      .set({
        closesAt: input.closesAt,
        ...(resolvesAt === market.resolvesAt ? {} : { resolvesAt }),
        updatedAt: now,
      })
      .where(eq(markets.id, market.id))
      .returning();
    const updatedMarket = updatedRows[0];

    if (!updatedMarket) {
      throw new AppError(
        500,
        'market_closing_update_failed',
        `failed to update closing schedule for ${market.id}`,
      );
    }

    return { market: updatedMarket };
  }

  async updateMarketStatus(
    marketId: string,
    input: {
      status: MarketStatus;
      reason: string;
      changedBy?: string;
    },
  ) {
    return db.transaction(async (tx) => {
      const [market] = await tx
        .select()
        .from(markets)
        .where(eq(markets.id, marketId))
        .limit(1);

      if (!market) {
        throw new AppError(
          404,
          'market_not_found',
          `market was not found: ${marketId}`,
        );
      }

      await acquireMarketWriteLock(tx, market.id);

      if (market.status === input.status) {
        return {
          market,
          alreadyApplied: true,
        };
      }

      assertAllowedMarketStatusTransition(market.status, input.status);

      const now = new Date();
      const updatedRows = await tx
        .update(markets)
        .set({
          status: input.status,
          statusChangedAt: now,
          updatedAt: now,
        })
        .where(eq(markets.id, market.id))
        .returning();
      const updatedMarket = updatedRows[0];

      if (!updatedMarket) {
        throw new AppError(
          500,
          'market_status_transition_failed',
          `failed to update market status for ${market.id}`,
        );
      }

      const transitionRows = await tx
        .insert(marketStatusTransitions)
        .values({
          marketId: market.id,
          fromStatus: market.status,
          toStatus: input.status,
          reason: input.reason,
          changedBy: input.changedBy,
        })
        .returning();
      const transition = transitionRows[0];

      if (!transition) {
        throw new AppError(
          500,
          'market_status_transition_failed',
          `failed to persist market status transition for ${market.id}`,
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'market.status_updated',
          actor: input.changedBy ?? 'bootstrap',
          targetType: 'market',
          targetId: market.id,
          payload: {
            fromStatus: market.status,
            toStatus: input.status,
            reason: input.reason,
          },
        },
        tx,
      );

      return {
        market: updatedMarket,
        transition: mapStatusTransition(transition),
        alreadyApplied: false,
      };
    });
  }
}
