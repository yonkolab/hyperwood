import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { marketAnnouncements } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { AdminAuditService } from '../operations/audit';
import {
  assertMarketExists,
  loadMarketSummary,
  mapAnnouncement,
} from './market-workflow-support';
import type { PublishMarketAnnouncementInput } from './types';

export class MarketAnnouncementService {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  /**
   * Return market announcements in reverse publication order.
   *
   * Example:
   * `await marketAnnouncementService.listMarketAnnouncements(marketId)`
   */
  async listMarketAnnouncements(marketId: string) {
    await assertMarketExists(marketId);

    const rows = await db
      .select()
      .from(marketAnnouncements)
      .where(eq(marketAnnouncements.marketId, marketId))
      .orderBy(
        desc(marketAnnouncements.publishedAt),
        desc(marketAnnouncements.createdAt),
      );

    return {
      marketId,
      announcements: rows.map((announcement) => mapAnnouncement(announcement)),
    };
  }

  /**
   * Publish a new market announcement and emit an audit event.
   *
   * Example:
   * `await marketAnnouncementService.publishMarketAnnouncement(marketId, input)`
   */
  async publishMarketAnnouncement(
    marketId: string,
    input: PublishMarketAnnouncementInput,
  ) {
    return db.transaction(async (tx) => {
      const market = await loadMarketSummary(tx, marketId);
      const insertedRows = await tx
        .insert(marketAnnouncements)
        .values({
          marketId,
          title: input.title,
          message: input.message,
          publishedBy: input.publishedBy,
        })
        .returning();
      const announcement = insertedRows[0];

      if (!announcement) {
        throw new AppError(
          500,
          'market_announcement_publish_failed',
          `failed to publish market announcement for market ${marketId}`,
        );
      }

      await this.adminAuditService.recordEvent(
        {
          action: 'market.announcement_published',
          actor: input.publishedBy ?? 'bootstrap',
          targetType: 'market',
          targetId: market.id,
          payload: {
            announcementId: announcement.id,
            title: announcement.title,
            status: market.status,
          },
        },
        tx,
      );

      return {
        market: {
          id: market.id,
          slug: market.slug,
          title: market.title,
          status: market.status,
        },
        announcement: mapAnnouncement(announcement),
      };
    });
  }
}
