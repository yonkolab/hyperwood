import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  marketEvents,
  marketResolutions,
  marketSettlements,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import {
  buildStatusTimeline,
  getOrderByClause,
  mapMarketRecord,
  mapResolution,
  mapSettlement,
  mapStatusTransition,
  marketStatusTransitions,
  markets,
} from './market-workflow-support';
import type { ListMarketsInput } from './types';

export class MarketCatalogQueryService {
  /**
   * List markets grouped by event with the current read filters applied.
   *
   * Example:
   * `await marketCatalogQueryService.listMarkets({ sort: 'newest', limit: 20 })`
   */
  async listMarkets(input: ListMarketsInput) {
    const rows = await db
      .select({
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
        currency: markets.currency,
        tags: markets.tags,
        yesPriceBps: markets.yesPriceBps,
        noPriceBps: markets.noPriceBps,
        volumeUsdMinor: markets.volumeUsdMinor,
        opensAt: markets.opensAt,
        closesAt: markets.closesAt,
        resolvesAt: markets.resolvesAt,
        statusChangedAt: markets.statusChangedAt,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        eventId: marketEvents.id,
        eventSlug: marketEvents.slug,
        eventTitle: marketEvents.title,
        eventSummary: marketEvents.summary,
        eventCategory: marketEvents.category,
        eventStartsAt: marketEvents.startsAt,
        eventEndsAt: marketEvents.endsAt,
      })
      .from(markets)
      .innerJoin(marketEvents, eq(marketEvents.id, markets.eventId))
      .where(
        and(
          input.category
            ? eq(marketEvents.category, input.category)
            : undefined,
          input.status ? eq(markets.status, input.status) : undefined,
          input.search
            ? or(
                ilike(markets.title, `%${input.search}%`),
                ilike(markets.summary, `%${input.search}%`),
                ilike(marketEvents.title, `%${input.search}%`),
                ilike(marketEvents.summary, `%${input.search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(...getOrderByClause(input.sort))
      .limit(Math.min(input.limit, 100));

    const records = rows
      .map((row) => mapMarketRecord(row))
      .filter((market) => (input.tag ? market.tags.includes(input.tag) : true));

    const eventGroups = Array.from(
      records.reduce(
        (groups, market) => {
          const existing = groups.get(market.event.id);

          if (existing) {
            existing.marketIds.push(market.id);
            return groups;
          }

          groups.set(market.event.id, {
            eventId: market.event.id,
            eventSlug: market.event.slug,
            eventTitle: market.event.title,
            category: market.event.category,
            marketIds: [market.id],
          });

          return groups;
        },
        new Map<
          string,
          {
            eventId: string;
            eventSlug: string;
            eventTitle: string;
            category: string;
            marketIds: string[];
          }
        >(),
      ),
    ).map(([, group]) => group);

    return {
      filters: {
        category: input.category ?? null,
        status: input.status ?? null,
        tag: input.tag ?? null,
        search: input.search ?? null,
        sort: input.sort ?? 'newest',
      },
      categories: Array.from(
        new Set(records.map((market) => market.event.category)),
      ),
      eventGroups,
      markets: records,
    };
  }

  /**
   * Return the full read model for one market.
   *
   * Example:
   * `await marketCatalogQueryService.getMarketDetail(marketId)`
   */
  async getMarketDetail(marketId: string) {
    const rows = await db
      .select({
        lastCommandSequence: markets.lastCommandSequence,
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
        currency: markets.currency,
        tags: markets.tags,
        resolutionRules: markets.resolutionRules,
        resolutionSources: markets.resolutionSources,
        yesPriceBps: markets.yesPriceBps,
        noPriceBps: markets.noPriceBps,
        volumeUsdMinor: markets.volumeUsdMinor,
        opensAt: markets.opensAt,
        closesAt: markets.closesAt,
        resolvesAt: markets.resolvesAt,
        statusChangedAt: markets.statusChangedAt,
        createdAt: markets.createdAt,
        updatedAt: markets.updatedAt,
        eventId: marketEvents.id,
        eventSlug: marketEvents.slug,
        eventTitle: marketEvents.title,
        eventSummary: marketEvents.summary,
        eventCategory: marketEvents.category,
        eventStartsAt: marketEvents.startsAt,
        eventEndsAt: marketEvents.endsAt,
      })
      .from(markets)
      .innerJoin(marketEvents, eq(marketEvents.id, markets.eventId))
      .where(eq(markets.id, marketId))
      .limit(1);
    const market = rows[0];

    if (!market) {
      throw new AppError(
        404,
        'market_not_found',
        `market was not found: ${marketId}`,
      );
    }

    const [resolution, settlement, statusTransitions] = await Promise.all([
      db
        .select()
        .from(marketResolutions)
        .where(eq(marketResolutions.marketId, marketId))
        .limit(1),
      db
        .select()
        .from(marketSettlements)
        .where(eq(marketSettlements.marketId, marketId))
        .limit(1),
      db
        .select()
        .from(marketStatusTransitions)
        .where(eq(marketStatusTransitions.marketId, marketId))
        .orderBy(asc(marketStatusTransitions.createdAt)),
    ]);

    const record = mapMarketRecord(market);

    return {
      market: {
        ...record,
        resolutionRules: market.resolutionRules,
        resolutionSources: market.resolutionSources,
        statusTimeline: buildStatusTimeline(market, statusTransitions),
        statusTransitions: statusTransitions.map((transition) =>
          mapStatusTransition(transition),
        ),
        lastCommandSequence: market.lastCommandSequence,
        resolution: resolution[0] ? mapResolution(resolution[0]) : null,
        settlement: settlement[0] ? mapSettlement(settlement[0]) : null,
      },
    };
  }
}
