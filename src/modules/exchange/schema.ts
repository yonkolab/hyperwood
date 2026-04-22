import { z } from 'zod';
import { marketCurrencySchema } from '../../config/currency';

export const weekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const weeklyWindowSchema = z
  .object({
    weekday: weekdaySchema,
    opensAt: z.string().regex(/^\d{2}:\d{2}$/),
    closesAt: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((value) => value.opensAt < value.closesAt, {
    message: 'closesAt must be later than opensAt',
    path: ['closesAt'],
  });

const maintenanceWindowSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  message: z.string().min(3).max(4000),
});

export const upsertExchangeScheduleBodySchema = z.object({
  name: z.string().min(3).max(160),
  timezone: z.string().min(3).max(64),
  weeklyWindows: z.array(weeklyWindowSchema).max(21),
  maintenanceWindows: z.array(maintenanceWindowSchema).max(16).default([]),
  notes: z.string().min(3).max(4000).optional(),
});

const currencySchema = marketCurrencySchema;

export const publishExchangeFeeScheduleBodySchema = z
  .object({
    name: z.string().min(3).max(160),
    currency: currencySchema,
    makerFeeBps: z.number().int().min(0).max(10000),
    takerFeeBps: z.number().int().min(0).max(10000),
    effectiveFrom: z.string().datetime(),
    effectiveUntil: z.string().datetime().optional(),
    notes: z.string().min(3).max(4000).optional(),
    publishedBy: z.string().min(3).max(128).optional(),
  })
  .refine(
    (value) =>
      !value.effectiveUntil ||
      new Date(value.effectiveUntil) > new Date(value.effectiveFrom),
    {
      message: 'effectiveUntil must be later than effectiveFrom',
      path: ['effectiveUntil'],
    },
  );

export const listExchangeFeeSchedulesQuerySchema = z.object({
  currency: currencySchema.optional(),
});
