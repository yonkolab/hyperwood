import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  marketCommentBookmarks,
  marketCommentLikes,
  marketCommentReports,
  marketComments,
  markets,
  users,
} from '../../db/schema';
import { COMMENT_MAX_DEPTH } from '../../db/schema/comments';
import { AppError, isUniqueViolation } from '../../lib/errors';

export type MarketCommentAuthor = {
  id: string;
  username: string | null;
  email: string;
};

export type MarketCommentNode = {
  id: string;
  marketId: string;
  parentId: string | null;
  body: string;
  depth: number;
  likeCount: number;
  replyCount: number;
  status: string;
  createdAt: Date;
  author: MarketCommentAuthor;
  viewer: {
    liked: boolean;
    bookmarked: boolean;
  };
  replies: MarketCommentNode[];
};

type ViewerContext = { userId: string } | null;

async function loadMarketAuthorId(marketId: string) {
  const rows = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1);

  return rows[0]?.id ?? null;
}

export async function listMarketComments(
  marketId: string,
  viewer: ViewerContext,
): Promise<MarketCommentNode[]> {
  const marketAuthorId = await loadMarketAuthorId(marketId);

  if (!marketAuthorId) {
    throw new AppError(404, 'market_not_found', 'market not found');
  }

  const commentRows = await db
    .select({
      id: marketComments.id,
      marketId: marketComments.marketId,
      parentId: marketComments.parentId,
      body: marketComments.body,
      depth: marketComments.depth,
      likeCount: marketComments.likeCount,
      replyCount: marketComments.replyCount,
      status: marketComments.status,
      createdAt: marketComments.createdAt,
      authorId: users.id,
      authorUsername: users.username,
      authorEmail: users.email,
    })
    .from(marketComments)
    .innerJoin(users, eq(users.id, marketComments.userId))
    .where(
      and(
        eq(marketComments.marketId, marketId),
        eq(marketComments.status, 'visible'),
      ),
    )
    .orderBy(asc(marketComments.createdAt))
    .limit(500);

  if (commentRows.length === 0) {
    return [];
  }

  const commentIds = commentRows.map((row) => row.id);
  const likedIds = new Set<string>();
  const bookmarkedIds = new Set<string>();

  if (viewer) {
    const [likedRows, bookmarkedRows] = await Promise.all([
      db
        .select({ commentId: marketCommentLikes.commentId })
        .from(marketCommentLikes)
        .where(
          and(
            eq(marketCommentLikes.userId, viewer.userId),
            inArray(marketCommentLikes.commentId, commentIds),
          ),
        ),
      db
        .select({ commentId: marketCommentBookmarks.commentId })
        .from(marketCommentBookmarks)
        .where(
          and(
            eq(marketCommentBookmarks.userId, viewer.userId),
            inArray(marketCommentBookmarks.commentId, commentIds),
          ),
        ),
    ]);

    for (const row of likedRows) {
      likedIds.add(row.commentId);
    }

    for (const row of bookmarkedRows) {
      bookmarkedIds.add(row.commentId);
    }
  }

  const nodesById = new Map<string, MarketCommentNode>();
  const roots: MarketCommentNode[] = [];

  for (const row of commentRows) {
    const node: MarketCommentNode = {
      id: row.id,
      marketId: row.marketId,
      parentId: row.parentId,
      body: row.body,
      depth: row.depth,
      likeCount: row.likeCount,
      replyCount: row.replyCount,
      status: row.status,
      createdAt: row.createdAt,
      author: {
        id: row.authorId,
        username: row.authorUsername,
        email: row.authorEmail,
      },
      viewer: {
        liked: likedIds.has(row.id),
        bookmarked: bookmarkedIds.has(row.id),
      },
      replies: [],
    };

    nodesById.set(row.id, node);

    if (row.parentId) {
      nodesById.get(row.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.reverse();
}

export type CreateMarketCommentInput = {
  marketId: string;
  userId: string;
  parentId?: string | null;
  body: string;
};

export async function createMarketComment(
  input: CreateMarketCommentInput,
): Promise<MarketCommentNode> {
  const marketAuthorId = await loadMarketAuthorId(input.marketId);

  if (!marketAuthorId) {
    throw new AppError(404, 'market_not_found', 'market not found');
  }

  const authorRows = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const author = authorRows[0];

  if (!author) {
    throw new AppError(404, 'user_not_found', 'user not found');
  }

  let parentRow:
    | { id: string; marketId: string; depth: number; status: string }
    | undefined;

  if (input.parentId) {
    parentRow = (
      await db
        .select({
          id: marketComments.id,
          marketId: marketComments.marketId,
          depth: marketComments.depth,
          status: marketComments.status,
        })
        .from(marketComments)
        .where(eq(marketComments.id, input.parentId))
        .limit(1)
    )[0];

    if (!parentRow || parentRow.status !== 'visible') {
      throw new AppError(
        404,
        'parent_comment_not_found',
        'parent comment not found',
      );
    }

    if (parentRow.marketId !== input.marketId) {
      throw new AppError(
        400,
        'parent_comment_mismatch',
        'parent comment belongs to another market',
      );
    }

    if (parentRow.depth + 1 > COMMENT_MAX_DEPTH) {
      throw new AppError(
        400,
        'comment_depth_exceeded',
        'comment nesting limit reached',
      );
    }
  }

  const createdRows = await db
    .insert(marketComments)
    .values({
      marketId: input.marketId,
      userId: input.userId,
      parentId: input.parentId ?? null,
      body: input.body,
      depth: parentRow ? parentRow.depth + 1 : 0,
    })
    .returning();
  const created = createdRows[0];

  if (!created) {
    throw new AppError(500, 'comment_creation_failed', 'failed to comment');
  }

  if (parentRow) {
    await db
      .update(marketComments)
      .set({
        replyCount: sql`${marketComments.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketComments.id, parentRow.id));
  }

  return {
    id: created.id,
    marketId: created.marketId,
    parentId: created.parentId,
    body: created.body,
    depth: created.depth,
    likeCount: created.likeCount,
    replyCount: created.replyCount,
    status: created.status,
    createdAt: created.createdAt,
    author: {
      id: author.id,
      username: author.username,
      email: author.email,
    },
    viewer: {
      liked: false,
      bookmarked: false,
    },
    replies: [],
  };
}

async function loadVisibleComment(commentId: string) {
  const rows = await db
    .select({
      id: marketComments.id,
      marketId: marketComments.marketId,
      userId: marketComments.userId,
      status: marketComments.status,
    })
    .from(marketComments)
    .where(eq(marketComments.id, commentId))
    .limit(1);

  return rows[0];
}

export async function toggleMarketCommentLike(input: {
  commentId: string;
  userId: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  const comment = await loadVisibleComment(input.commentId);

  if (!comment || comment.status !== 'visible') {
    throw new AppError(404, 'comment_not_found', 'comment not found');
  }

  const existingRows = await db
    .select({ id: marketCommentLikes.id })
    .from(marketCommentLikes)
    .where(
      and(
        eq(marketCommentLikes.commentId, input.commentId),
        eq(marketCommentLikes.userId, input.userId),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db
      .delete(marketCommentLikes)
      .where(eq(marketCommentLikes.id, existing.id));

    const updatedRows = await db
      .update(marketComments)
      .set({
        likeCount: sql`GREATEST(${marketComments.likeCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(marketComments.id, input.commentId))
      .returning({ likeCount: marketComments.likeCount });

    return { liked: false, likeCount: updatedRows[0]?.likeCount ?? 0 };
  }

  try {
    await db.insert(marketCommentLikes).values({
      commentId: input.commentId,
      userId: input.userId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const updatedRows = await db
        .select({ likeCount: marketComments.likeCount })
        .from(marketComments)
        .where(eq(marketComments.id, input.commentId));

      return { liked: true, likeCount: updatedRows[0]?.likeCount ?? 0 };
    }

    throw error;
  }

  const updatedRows = await db
    .update(marketComments)
    .set({
      likeCount: sql`${marketComments.likeCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(marketComments.id, input.commentId))
    .returning({ likeCount: marketComments.likeCount });

  return { liked: true, likeCount: updatedRows[0]?.likeCount ?? 1 };
}

export async function toggleMarketCommentBookmark(input: {
  commentId: string;
  userId: string;
}): Promise<{ bookmarked: boolean }> {
  const comment = await loadVisibleComment(input.commentId);

  if (!comment || comment.status !== 'visible') {
    throw new AppError(404, 'comment_not_found', 'comment not found');
  }

  const existingRows = await db
    .select({ id: marketCommentBookmarks.id })
    .from(marketCommentBookmarks)
    .where(
      and(
        eq(marketCommentBookmarks.commentId, input.commentId),
        eq(marketCommentBookmarks.userId, input.userId),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db
      .delete(marketCommentBookmarks)
      .where(eq(marketCommentBookmarks.id, existing.id));

    return { bookmarked: false };
  }

  try {
    await db.insert(marketCommentBookmarks).values({
      commentId: input.commentId,
      userId: input.userId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { bookmarked: true };
    }

    throw error;
  }

  return { bookmarked: true };
}

export async function reportMarketComment(input: {
  commentId: string;
  reporterId: string;
  reason: string;
}): Promise<{ reported: boolean }> {
  const comment = await loadVisibleComment(input.commentId);

  if (!comment || comment.status !== 'visible') {
    throw new AppError(404, 'comment_not_found', 'comment not found');
  }

  try {
    await db.insert(marketCommentReports).values({
      commentId: input.commentId,
      reporterId: input.reporterId,
      reason: input.reason,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { reported: true };
    }

    throw error;
  }

  return { reported: true };
}
