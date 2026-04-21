import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  fundingMethods,
  fundingTransfers,
  ledgerEntries,
  ledgerTransactions,
  providerWebhookEvents,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { mapProviderWebhookEvent, mapTransfer } from './funding-record-mapper';
import type { FundingWalletLedgerService } from './funding-wallet-ledger.service';
import type { DbExecutor, ProcessProviderFundingWebhookInput } from './types';

type TransferWebhookRecord = {
  id: string;
  userId: string;
  fundingMethodId: string;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'in_review' | 'settled' | 'failed';
  amountMinor: number;
  currency: string;
  metadata: Record<string, unknown>;
  requestedAt: Date;
  settledAt: Date | null;
  failedAt: Date | null;
  providerTransferReference: string | null;
  failureReason: string | null;
  fundingMethodRail: typeof fundingMethods.$inferSelect.rail;
  fundingMethodDisplayName: string;
  provider: string | null;
};

type WebhookWorkflowDependencies = {
  walletLedgerService: FundingWalletLedgerService;
};

export class FundingWebhookWorkflowService {
  constructor(
    private readonly walletLedgerService: FundingWalletLedgerService,
  ) {}

  /**
   * Apply an idempotent provider webhook to a funding transfer.
   *
   * Example:
   * `await fundingWebhookWorkflowService.processProviderFundingWebhook(input)`
   */
  async processProviderFundingWebhook(
    input: ProcessProviderFundingWebhookInput,
  ) {
    return processProviderFundingWebhook(
      { walletLedgerService: this.walletLedgerService },
      input,
    );
  }
}

async function processProviderFundingWebhook(
  dependencies: WebhookWorkflowDependencies,
  input: ProcessProviderFundingWebhookInput,
) {
  return db.transaction(async (tx) => {
    const existingEventRows = await tx
      .select()
      .from(providerWebhookEvents)
      .where(
        and(
          eq(providerWebhookEvents.provider, input.provider),
          eq(providerWebhookEvents.eventId, input.eventId),
        ),
      )
      .limit(1);
    const existingEvent = existingEventRows[0];

    if (existingEvent) {
      const transfer = await loadTransferForWebhook(tx, input.transferId);

      return {
        alreadyProcessed: true,
        transfer: mapTransfer(transfer),
        webhookEvent: mapProviderWebhookEvent(existingEvent),
      };
    }

    const transfer = await loadTransferForWebhook(tx, input.transferId);

    if (transfer.provider !== input.provider) {
      throw new AppError(
        409,
        'provider_mismatch',
        `provider ${input.provider} does not match linked funding method provider ${String(transfer.provider)}`,
      );
    }

    const nextTransfer =
      input.status === 'pending'
        ? await refreshTransferProviderState(tx, transfer, input)
        : input.status === 'in_review'
          ? await applyProviderReviewState(tx, transfer, input)
          : input.status === 'settled'
            ? await applyProviderSettledState(dependencies, tx, transfer, input)
            : await applyProviderFailedState(dependencies, tx, transfer, input);

    const eventRows = await tx
      .insert(providerWebhookEvents)
      .values({
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        transferId: nextTransfer.id,
        status: 'applied',
        payload: input.payload,
        processedAt: new Date(),
      })
      .returning();
    const webhookEvent = eventRows[0];

    if (!webhookEvent) {
      throw new AppError(
        500,
        'provider_webhook_record_failed',
        `failed to persist provider webhook event ${input.eventId}`,
      );
    }

    return {
      alreadyProcessed: false,
      transfer: mapTransfer(nextTransfer),
      webhookEvent: mapProviderWebhookEvent(webhookEvent),
    };
  });
}

async function loadTransferForWebhook(
  executor: DbExecutor,
  transferId: string,
) {
  const rows = await executor
    .select({
      id: fundingTransfers.id,
      userId: fundingTransfers.userId,
      fundingMethodId: fundingTransfers.fundingMethodId,
      type: fundingTransfers.type,
      status: fundingTransfers.status,
      amountMinor: fundingTransfers.amountMinor,
      currency: fundingTransfers.currency,
      metadata: fundingTransfers.metadata,
      requestedAt: fundingTransfers.requestedAt,
      settledAt: fundingTransfers.settledAt,
      failedAt: fundingTransfers.failedAt,
      providerTransferReference: fundingTransfers.providerTransferReference,
      failureReason: fundingTransfers.failureReason,
      fundingMethodRail: fundingMethods.rail,
      fundingMethodDisplayName: fundingMethods.displayName,
      provider: fundingMethods.provider,
    })
    .from(fundingTransfers)
    .innerJoin(
      fundingMethods,
      eq(fundingMethods.id, fundingTransfers.fundingMethodId),
    )
    .where(eq(fundingTransfers.id, transferId))
    .limit(1);
  const transfer = rows[0];

  if (!transfer) {
    throw new AppError(
      404,
      'funding_transfer_not_found',
      `funding transfer was not found for id ${transferId}`,
    );
  }

  return {
    ...transfer,
    metadata:
      transfer.metadata && typeof transfer.metadata === 'object'
        ? transfer.metadata
        : {},
  } as TransferWebhookRecord;
}

function mergeWebhookTransferMetadata(
  metadata: Record<string, unknown>,
  input: ProcessProviderFundingWebhookInput,
) {
  return {
    ...metadata,
    lastProviderWebhookAt: input.occurredAt.toISOString(),
    lastProviderWebhookEventId: input.eventId,
    lastProviderWebhookEventType: input.eventType,
    lastProviderWebhookStatus: input.status,
    providerTransferReference:
      input.providerTransferReference ?? metadata.providerTransferReference,
  };
}

async function refreshTransferProviderState(
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
) {
  const updatedRows = await executor
    .update(fundingTransfers)
    .set({
      providerTransferReference:
        input.providerTransferReference ?? transfer.providerTransferReference,
      metadata: mergeWebhookTransferMetadata(transfer.metadata, input),
      updatedAt: new Date(),
    })
    .where(eq(fundingTransfers.id, transfer.id))
    .returning();
  const nextTransfer = updatedRows[0];

  if (!nextTransfer) {
    throw new AppError(
      500,
      'provider_webhook_apply_failed',
      `failed to refresh provider state for transfer ${transfer.id}`,
    );
  }

  return {
    ...transfer,
    ...nextTransfer,
  };
}

async function applyProviderReviewState(
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
) {
  if (transfer.type !== 'withdrawal') {
    throw new AppError(
      409,
      'provider_status_not_supported',
      `in_review webhook status is only supported for withdrawals, received ${transfer.type}`,
    );
  }

  if (transfer.status === 'in_review') {
    return refreshTransferProviderState(executor, transfer, input);
  }

  if (transfer.status !== 'pending') {
    throw new AppError(
      409,
      'provider_webhook_transition_not_allowed',
      `transfer ${transfer.id} is not eligible for provider review status from ${transfer.status}`,
    );
  }

  const updatedRows = await executor
    .update(fundingTransfers)
    .set({
      status: 'in_review',
      providerTransferReference:
        input.providerTransferReference ?? transfer.providerTransferReference,
      metadata: {
        ...mergeWebhookTransferMetadata(transfer.metadata, input),
        requiresReview: true,
        reviewReason: 'provider_review_required',
      },
      updatedAt: new Date(),
    })
    .where(eq(fundingTransfers.id, transfer.id))
    .returning();
  const nextTransfer = updatedRows[0];

  if (!nextTransfer) {
    throw new AppError(
      500,
      'provider_webhook_apply_failed',
      `failed to mark transfer ${transfer.id} as in review`,
    );
  }

  return {
    ...transfer,
    ...nextTransfer,
  };
}

async function applyProviderSettledState(
  dependencies: WebhookWorkflowDependencies,
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
) {
  if (transfer.status === 'settled') {
    return refreshTransferProviderState(executor, transfer, input);
  }

  if (transfer.type === 'deposit') {
    return settleDepositFromWebhook(dependencies, executor, transfer, input);
  }

  if (transfer.status !== 'pending') {
    throw new AppError(
      409,
      'provider_webhook_transition_not_allowed',
      `withdrawal ${transfer.id} is not eligible for settlement from ${transfer.status}`,
    );
  }

  const withdrawalHoldWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: transfer.userId,
        type: 'user_withdrawal_hold',
        currency: transfer.currency,
      },
      executor,
    );
  const platformClearingWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: null,
        type: 'platform_clearing',
        currency: transfer.currency,
      },
      executor,
    );

  const transactionRows = await executor
    .insert(ledgerTransactions)
    .values({
      referenceType: 'withdrawal_settlement',
      referenceId: transfer.id,
      metadata: {
        fundingMethodId: transfer.fundingMethodId,
        rail: transfer.fundingMethodRail,
        provider: input.provider,
        providerTransferReference: input.providerTransferReference ?? null,
      },
    })
    .returning({ id: ledgerTransactions.id });
  const transaction = transactionRows[0];

  if (!transaction) {
    throw new AppError(
      500,
      'ledger_transaction_failed',
      `failed to create settlement transaction for transfer ${transfer.id}`,
    );
  }

  await executor.insert(ledgerEntries).values([
    {
      transactionId: transaction.id,
      walletAccountId: withdrawalHoldWallet.id,
      side: 'debit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
    {
      transactionId: transaction.id,
      walletAccountId: platformClearingWallet.id,
      side: 'credit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
  ]);

  return finalizeWebhookTransfer(executor, transfer, input, {
    status: 'settled',
    settledAt: new Date(),
  });
}

async function applyProviderFailedState(
  dependencies: WebhookWorkflowDependencies,
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
) {
  if (transfer.status === 'failed') {
    return refreshTransferProviderState(executor, transfer, input);
  }

  const failureReason = input.failureReason ?? 'provider_webhook_failure';

  if (transfer.type === 'deposit') {
    if (transfer.status !== 'pending') {
      throw new AppError(
        409,
        'provider_webhook_transition_not_allowed',
        `deposit ${transfer.id} is not eligible for failure from ${transfer.status}`,
      );
    }

    return finalizeWebhookTransfer(executor, transfer, input, {
      status: 'failed',
      failureReason,
      failedAt: new Date(),
    });
  }

  if (transfer.status === 'settled') {
    throw new AppError(
      409,
      'provider_webhook_transition_not_allowed',
      `settled withdrawal ${transfer.id} cannot be failed`,
    );
  }

  const cashWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: transfer.userId,
        type: 'user_cash',
        currency: transfer.currency,
      },
      executor,
    );
  const withdrawalHoldWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: transfer.userId,
        type: 'user_withdrawal_hold',
        currency: transfer.currency,
      },
      executor,
    );

  const transactionRows = await executor
    .insert(ledgerTransactions)
    .values({
      referenceType: 'withdrawal_release',
      referenceId: transfer.id,
      metadata: {
        fundingMethodId: transfer.fundingMethodId,
        rail: transfer.fundingMethodRail,
        provider: input.provider,
        providerTransferReference: input.providerTransferReference ?? null,
        failureReason,
      },
    })
    .returning({ id: ledgerTransactions.id });
  const transaction = transactionRows[0];

  if (!transaction) {
    throw new AppError(
      500,
      'ledger_transaction_failed',
      `failed to create withdrawal release transaction for transfer ${transfer.id}`,
    );
  }

  await executor.insert(ledgerEntries).values([
    {
      transactionId: transaction.id,
      walletAccountId: withdrawalHoldWallet.id,
      side: 'debit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
    {
      transactionId: transaction.id,
      walletAccountId: cashWallet.id,
      side: 'credit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
  ]);

  return finalizeWebhookTransfer(executor, transfer, input, {
    status: 'failed',
    failureReason,
    failedAt: new Date(),
  });
}

async function settleDepositFromWebhook(
  dependencies: WebhookWorkflowDependencies,
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
) {
  if (transfer.status !== 'pending') {
    throw new AppError(
      409,
      'provider_webhook_transition_not_allowed',
      `deposit ${transfer.id} is not eligible for settlement from ${transfer.status}`,
    );
  }

  const userWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: transfer.userId,
        type: 'user_cash',
        currency: transfer.currency,
      },
      executor,
    );
  const platformClearingWallet =
    await dependencies.walletLedgerService.getOrCreateWalletAccount(
      {
        ownerUserId: null,
        type: 'platform_clearing',
        currency: transfer.currency,
      },
      executor,
    );

  const transactionRows = await executor
    .insert(ledgerTransactions)
    .values({
      referenceType: 'deposit_settlement',
      referenceId: transfer.id,
      metadata: {
        fundingMethodId: transfer.fundingMethodId,
        rail: transfer.fundingMethodRail,
        provider: input.provider,
        providerTransferReference: input.providerTransferReference ?? null,
      },
    })
    .returning({ id: ledgerTransactions.id });
  const transaction = transactionRows[0];

  if (!transaction) {
    throw new AppError(
      500,
      'ledger_transaction_failed',
      `failed to create deposit settlement transaction for transfer ${transfer.id}`,
    );
  }

  await executor.insert(ledgerEntries).values([
    {
      transactionId: transaction.id,
      walletAccountId: userWallet.id,
      side: 'credit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
    {
      transactionId: transaction.id,
      walletAccountId: platformClearingWallet.id,
      side: 'debit',
      amountMinor: transfer.amountMinor,
      currency: transfer.currency,
    },
  ]);

  return finalizeWebhookTransfer(executor, transfer, input, {
    status: 'settled',
    settledAt: new Date(),
  });
}

async function finalizeWebhookTransfer(
  executor: DbExecutor,
  transfer: TransferWebhookRecord,
  input: ProcessProviderFundingWebhookInput,
  state: {
    status: 'settled' | 'failed';
    settledAt?: Date;
    failedAt?: Date;
    failureReason?: string;
  },
) {
  const updatedRows = await executor
    .update(fundingTransfers)
    .set({
      status: state.status,
      settledAt: state.settledAt ?? null,
      failedAt: state.failedAt ?? null,
      failureReason: state.failureReason ?? null,
      providerTransferReference:
        input.providerTransferReference ?? transfer.providerTransferReference,
      metadata: mergeWebhookTransferMetadata(transfer.metadata, input),
      updatedAt: new Date(),
    })
    .where(eq(fundingTransfers.id, transfer.id))
    .returning();
  const nextTransfer = updatedRows[0];

  if (!nextTransfer) {
    throw new AppError(
      500,
      'provider_webhook_apply_failed',
      `failed to finalize webhook state for transfer ${transfer.id}`,
    );
  }

  return {
    ...transfer,
    ...nextTransfer,
  };
}
