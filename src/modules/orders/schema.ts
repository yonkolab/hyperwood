import { z } from 'zod';

export const createOrderBodySchema = z
  .object({
    marketId: z.string().uuid(),
    type: z.enum(['limit', 'market']),
    side: z.enum(['buy', 'sell']),
    outcome: z.enum(['yes', 'no']),
    quantity: z.number().int().positive(),
    limitPriceBps: z.number().int().min(1).max(9999).optional(),
    selfTradePrevention: z
      .enum(['decrement_and_cancel', 'cancel_oldest', 'cancel_newest'])
      .default('decrement_and_cancel'),
  })
  .superRefine((body, ctx) => {
    if (body.type === 'limit' && body.limitPriceBps === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitPriceBps'],
        message: 'limitPriceBps is required for limit orders',
      });
    }

    if (body.type === 'market' && body.limitPriceBps !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitPriceBps'],
        message: 'limitPriceBps is not allowed for market orders',
      });
    }
  });

export const orderParamsSchema = z.object({
  orderId: z.string().uuid(),
});

export const amendOrderBodySchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    limitPriceBps: z.number().int().min(1).max(9999).optional(),
  })
  .refine(
    (body) => body.quantity !== undefined || body.limitPriceBps !== undefined,
    {
      message: 'quantity or limitPriceBps is required',
    },
  );
