import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/client";
import {
  marketEvents,
  markets,
  marketStatusEnum,
} from "../../db/schema";
import { AppError } from "../../lib/errors";

type MarketStatus = (typeof marketStatusEnum.enumValues)[number];

type CreateMarketEventInput = {
  slug: string;
  title: string;
  summary?: string;
  category: string;
  startsAt?: Date;
  endsAt?: Date;
};

type CreateMarketInput = {
  eventId: string;
  slug: string;
  title: string;
  summary?: string;
  status: MarketStatus;
  tags?: string[];
  resolutionRules: string;
  resolutionSources?: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor?: number;
  opensAt?: Date;
  closesAt?: Date;
  resolvesAt?: Date;
};

type ListMarketsInput = {
  category?: string;
  status?: MarketStatus;
  tag?: string;
  search?: string;
  sort?: "newest" | "closing_soon" | "highest_volume";
  limit: number;
};

type MarketRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: MarketStatus;
  tags: string[];
  yesPriceBps: number;
  noPriceBps: number;
  volumeUsdMinor: number;
  opensAt: Date | null;
  closesAt: Date | null;
  resolvesAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    category: string;
    startsAt: Date | null;
    endsAt: Date | null;
  };
};

export class MarketsService {
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

  async createMarket(input: CreateMarketInput) {
    await this.assertEventExists(input.eventId);
    this.assertPriceSnapshot(input.yesPriceBps, input.noPriceBps);

    const insertedRows = await db
      .insert(markets)
      .values({
        eventId: input.eventId,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        status: input.status,
        tags: input.tags ?? [],
        resolutionRules: input.resolutionRules,
        resolutionSources: input.resolutionSources ?? [],
        yesPriceBps: input.yesPriceBps,
        noPriceBps: input.noPriceBps,
        volumeUsdMinor: input.volumeUsdMinor ?? 0,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        resolvesAt: input.resolvesAt,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      market: insertedRows[0],
    };
  }

  async listMarkets(input: ListMarketsInput) {
    const rows = await db
      .select({
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
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
          input.category ? eq(marketEvents.category, input.category) : undefined,
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
      .orderBy(...this.getOrderByClause(input.sort))
      .limit(Math.min(input.limit, 100));

    const records = rows
      .map((row) => this.mapMarketRecord(row))
      .filter((market) => (input.tag ? market.tags.includes(input.tag) : true));

    const eventGroups = Array.from(
      records.reduce((groups, market) => {
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
      }, new Map<string, { eventId: string; eventSlug: string; eventTitle: string; category: string; marketIds: string[] }>()),
    ).map(([, group]) => group);

    return {
      filters: {
        category: input.category ?? null,
        status: input.status ?? null,
        tag: input.tag ?? null,
        search: input.search ?? null,
        sort: input.sort ?? "newest",
      },
      categories: Array.from(new Set(records.map((market) => market.event.category))),
      eventGroups,
      markets: records,
    };
  }

  async getMarketDetail(marketId: string) {
    const rows = await db
      .select({
        id: markets.id,
        slug: markets.slug,
        title: markets.title,
        summary: markets.summary,
        status: markets.status,
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
      throw new AppError(404, "market_not_found", "market was not found");
    }

    const record = this.mapMarketRecord(market);

    return {
      market: {
        ...record,
        resolutionRules: market.resolutionRules,
        resolutionSources: market.resolutionSources,
        statusTimeline: this.buildStatusTimeline(market),
      },
    };
  }

  private async assertEventExists(eventId: string) {
    const [event] = await db
      .select({
        id: marketEvents.id,
      })
      .from(marketEvents)
      .where(eq(marketEvents.id, eventId))
      .limit(1);

    if (!event) {
      throw new AppError(404, "event_not_found", "event was not found");
    }
  }

  private assertPriceSnapshot(yesPriceBps: number, noPriceBps: number) {
    if (
      !Number.isInteger(yesPriceBps) ||
      !Number.isInteger(noPriceBps) ||
      yesPriceBps < 0 ||
      noPriceBps < 0 ||
      yesPriceBps > 10000 ||
      noPriceBps > 10000 ||
      yesPriceBps + noPriceBps !== 10000
    ) {
      throw new AppError(
        400,
        "invalid_price_snapshot",
        "yes and no prices must be integer basis points summing to 10000",
      );
    }
  }

  private getOrderByClause(sort: ListMarketsInput["sort"]) {
    switch (sort) {
      case "closing_soon":
        return [asc(markets.closesAt), desc(markets.createdAt)];
      case "highest_volume":
        return [desc(markets.volumeUsdMinor), desc(markets.createdAt)];
      case "newest":
      default:
        return [desc(markets.createdAt)];
    }
  }

  private mapMarketRecord(row: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    status: MarketStatus;
    tags: string[];
    yesPriceBps: number;
    noPriceBps: number;
    volumeUsdMinor: number;
    opensAt: Date | null;
    closesAt: Date | null;
    resolvesAt: Date | null;
    statusChangedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    eventId: string;
    eventSlug: string;
    eventTitle: string;
    eventSummary: string | null;
    eventCategory: string;
    eventStartsAt: Date | null;
    eventEndsAt: Date | null;
  }): MarketRecord {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      status: row.status,
      tags: row.tags,
      yesPriceBps: row.yesPriceBps,
      noPriceBps: row.noPriceBps,
      volumeUsdMinor: row.volumeUsdMinor,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      resolvesAt: row.resolvesAt,
      statusChangedAt: row.statusChangedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      event: {
        id: row.eventId,
        slug: row.eventSlug,
        title: row.eventTitle,
        summary: row.eventSummary,
        category: row.eventCategory,
        startsAt: row.eventStartsAt,
        endsAt: row.eventEndsAt,
      },
    };
  }

  private buildStatusTimeline(row: {
    createdAt: Date;
    opensAt: Date | null;
    closesAt: Date | null;
    resolvesAt: Date | null;
    status: MarketStatus;
    statusChangedAt: Date;
  }) {
    const timeline = [
      {
        milestone: "created",
        at: row.createdAt,
      },
    ];

    if (row.opensAt) {
      timeline.push({
        milestone: "opens",
        at: row.opensAt,
      });
    }

    if (row.closesAt) {
      timeline.push({
        milestone: "closes",
        at: row.closesAt,
      });
    }

    if (row.resolvesAt) {
      timeline.push({
        milestone: "resolves",
        at: row.resolvesAt,
      });
    }

    timeline.push({
      milestone: `status:${row.status}`,
      at: row.statusChangedAt,
    });

    return timeline;
  }
}
