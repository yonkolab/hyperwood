import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app';
import { createVerifiedSession } from '../helpers/auth';
import { createMarket, createMarketEvent } from '../helpers/bootstrap';

async function createComment(
  app: FastifyInstance,
  marketId: string,
  sessionToken: string,
  body: string,
  parentId?: string,
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/markets/${marketId}/comments`,
    headers: { authorization: `Bearer ${sessionToken}` },
    payload: { body, ...(parentId ? { parentId } : {}) },
  });
}

async function setupCommentsScenario(app: FastifyInstance, title?: string) {
  const session = await createVerifiedSession(app);
  const event = await createMarketEvent(app, {
    title: title ?? 'Comments API Event',
  });
  const market = await createMarket(app, event.body.event.id as string, {
    title: 'Comments API Market',
  });

  return {
    session,
    marketId: market.body.market.id as string,
  };
}

describe('market comments api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a top-level comment', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const response = await createComment(
      app,
      marketId,
      session.sessionToken,
      'primeiro comentário do mercado',
    );

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.comment.id).toEqual(expect.any(String));
    expect(body.comment.parentId).toBe(null);
    expect(body.comment.depth).toBe(0);
    expect(body.comment.body).toBe('primeiro comentário do mercado');
    expect(body.comment.author.email).toEqual(expect.any(String));
  });

  it('lists comments anonymously with viewer state false', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const root = await createComment(
      app,
      marketId,
      session.sessionToken,
      'comentário raiz',
    );
    const rootId = root.json().comment.id as string;

    const reply = await createComment(
      app,
      marketId,
      session.sessionToken,
      'resposta ao raiz',
      rootId,
    );

    expect(reply.statusCode).toBe(201);
    expect(reply.json().comment.parentId).toBe(rootId);
    expect(reply.json().comment.depth).toBe(1);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${marketId}/comments`,
    });

    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].replies).toHaveLength(1);
    expect(body.comments[0].replies[0].body).toBe('resposta ao raiz');
    expect(body.comments[0].viewer.liked).toBe(false);
  });

  it('requires session to comment', async () => {
    const { marketId } = await setupCommentsScenario(app);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/markets/${marketId}/comments`,
      payload: { body: 'sem sessão' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('toggles like on and off', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const created = await createComment(
      app,
      marketId,
      session.sessionToken,
      'comentário com like',
    );
    const commentId = created.json().comment.id as string;

    const liked = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/like`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
    });

    expect(liked.statusCode).toBe(200);
    expect(liked.json()).toEqual({ liked: true, likeCount: 1 });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/markets/${marketId}/comments`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
    });
    expect(list.json().comments[0].viewer.liked).toBe(true);

    const unliked = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/like`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
    });

    expect(unliked.json()).toEqual({ liked: false, likeCount: 0 });
  });

  it('toggles bookmark', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const created = await createComment(
      app,
      marketId,
      session.sessionToken,
      'comentário com bookmark',
    );
    const commentId = created.json().comment.id as string;

    const bookmarked = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/bookmark`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
    });

    expect(bookmarked.json()).toEqual({ bookmarked: true });

    const removed = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/bookmark`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
    });

    expect(removed.json()).toEqual({ bookmarked: false });
  });

  it('reports a comment idempotently', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const created = await createComment(
      app,
      marketId,
      session.sessionToken,
      'comentário reportável',
    );
    const commentId = created.json().comment.id as string;

    const report = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/report`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
      payload: { reason: 'conteúdo impróprio' },
    });

    expect(report.statusCode).toBe(200);
    expect(report.json()).toEqual({ reported: true });

    const repeat = await app.inject({
      method: 'POST',
      url: `/api/v1/comments/${commentId}/report`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
      payload: { reason: 'conteúdo impróprio' },
    });

    expect(repeat.statusCode).toBe(200);
    expect(repeat.json()).toEqual({ reported: true });
  });

  it('rejects replies to comments of another market', async () => {
    const { session, marketId } = await setupCommentsScenario(app);

    const otherEvent = await createMarketEvent(app, {
      title: 'Comments API Other Event',
    });
    const otherMarket = await createMarket(
      app,
      otherEvent.body.event.id as string,
      { title: 'Comments API Other Market' },
    );

    const root = await createComment(
      app,
      marketId,
      session.sessionToken,
      'raiz do mercado principal',
    );
    const rootId = root.json().comment.id as string;

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/markets/${otherMarket.body.market.id}/comments`,
      headers: { authorization: `Bearer ${session.sessionToken}` },
      payload: { body: 'resposta errada', parentId: rootId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'parent_comment_mismatch' });
  });
});
