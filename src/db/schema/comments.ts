import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { markets } from './markets';
import { users } from './users';

const COMMENT_MAX_DEPTH = 10;

export const marketComments = pgTable(
  'market_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketId: uuid('market_id')
      .notNull()
      .references(() => markets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    depth: integer('depth').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('visible'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('market_comments_market_created_idx').on(
      table.marketId,
      table.createdAt,
    ),
    index('market_comments_parent_idx').on(table.parentId),
    index('market_comments_user_idx').on(table.userId),
  ],
);

export const marketCommentLikes = pgTable(
  'market_comment_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => marketComments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('market_comment_likes_unique').on(
      table.commentId,
      table.userId,
    ),
  ],
);

export const marketCommentBookmarks = pgTable(
  'market_comment_bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => marketComments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('market_comment_bookmarks_unique').on(
      table.commentId,
      table.userId,
    ),
  ],
);

export const marketCommentReports = pgTable(
  'market_comment_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => marketComments.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 160 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('market_comment_reports_unique').on(
      table.commentId,
      table.reporterId,
    ),
  ],
);

export { COMMENT_MAX_DEPTH };
