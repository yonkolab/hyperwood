import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  walletAccounts,
} from '../../db/schema';
import { OperationsAlertService } from './alerts';

type ImbalancedLedgerTransaction = {
  transactionId: string;
  currency: string | null;
  currencyCount: number;
  debitTotalMinor: number;
  creditTotalMinor: number;
  createdAt: string;
};

type NegativeWalletBalance = {
  walletAccountId: string;
  ownerUserId: string | null;
  walletAccountType: string;
  currency: string;
  balanceMinor: number;
  createdAt: string;
};

export class LedgerInvariantAlertService {
  private readonly operationsAlertService = new OperationsAlertService();

  /**
   * Scan current ledger state for invariant failures and persist alerts.
   *
   * Example:
   * `await ledgerInvariantAlertService.scan({ limit: 25 })`
   */
  async scan(input: { limit: number }) {
    const [imbalancedTransactions, negativeWalletBalances] = await Promise.all([
      this.listImbalancedTransactions(input.limit),
      this.listNegativeWalletBalances(input.limit),
    ]);

    let alertsCreated = 0;

    for (const transaction of imbalancedTransactions) {
      const alert = await this.operationsAlertService.createAlert({
        category: 'ledger_invariant',
        severity: 'critical',
        sourceType: 'ledger_transaction',
        sourceId: transaction.transactionId,
        message: 'ledger transaction debits and credits are not balanced',
        metadata: {
          currency: transaction.currency,
          currencyCount: transaction.currencyCount,
          debitTotalMinor: transaction.debitTotalMinor,
          creditTotalMinor: transaction.creditTotalMinor,
          createdAt: transaction.createdAt,
        },
      });

      alertsCreated += alert ? 1 : 0;
    }

    for (const walletBalance of negativeWalletBalances) {
      const alert = await this.operationsAlertService.createAlert({
        category: 'ledger_invariant',
        severity: 'critical',
        sourceType: 'wallet_account',
        sourceId: walletBalance.walletAccountId,
        message: 'user wallet balance is negative',
        metadata: {
          ownerUserId: walletBalance.ownerUserId,
          walletAccountType: walletBalance.walletAccountType,
          currency: walletBalance.currency,
          balanceMinor: walletBalance.balanceMinor,
          createdAt: walletBalance.createdAt,
        },
      });

      alertsCreated += alert ? 1 : 0;
    }

    return {
      generatedAt: new Date().toISOString(),
      alertsCreated,
      imbalancedTransactions,
      negativeWalletBalances,
    };
  }

  private async listImbalancedTransactions(limit: number) {
    const rows = await db
      .select({
        transactionId: ledgerTransactions.id,
        currency: sql<string | null>`min(${ledgerEntries.currency})`,
        currencyCount:
          sql<number>`count(distinct ${ledgerEntries.currency})`.mapWith(
            Number,
          ),
        debitTotalMinor:
          sql<number>`coalesce(sum(case when ${ledgerEntries.side} = 'debit' then ${ledgerEntries.amountMinor} else 0 end), 0)`.mapWith(
            Number,
          ),
        creditTotalMinor:
          sql<number>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else 0 end), 0)`.mapWith(
            Number,
          ),
        createdAt: ledgerTransactions.createdAt,
      })
      .from(ledgerTransactions)
      .leftJoin(
        ledgerEntries,
        eq(ledgerEntries.transactionId, ledgerTransactions.id),
      )
      .groupBy(ledgerTransactions.id, ledgerTransactions.createdAt)
      .having(
        sql`
          coalesce(sum(case when ${ledgerEntries.side} = 'debit' then ${ledgerEntries.amountMinor} else 0 end), 0) !=
          coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else 0 end), 0)
          or count(distinct ${ledgerEntries.currency}) > 1
        `,
      )
      .limit(Math.min(inputLimit(limit), 100));

    return rows.map(
      (row): ImbalancedLedgerTransaction => ({
        transactionId: row.transactionId,
        currency: row.currency,
        currencyCount: row.currencyCount,
        debitTotalMinor: row.debitTotalMinor,
        creditTotalMinor: row.creditTotalMinor,
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }

  private async listNegativeWalletBalances(limit: number) {
    const rows = await db
      .select({
        walletAccountId: walletAccounts.id,
        ownerUserId: walletAccounts.ownerUserId,
        walletAccountType: walletAccounts.type,
        currency: walletAccounts.currency,
        balanceMinor:
          sql<number>`coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0)`.mapWith(
            Number,
          ),
        createdAt: walletAccounts.createdAt,
      })
      .from(walletAccounts)
      .leftJoin(
        ledgerEntries,
        eq(ledgerEntries.walletAccountId, walletAccounts.id),
      )
      .where(
        and(
          ne(walletAccounts.type, 'platform_clearing'),
          sql`${walletAccounts.ownerUserId} is not null`,
        ),
      )
      .groupBy(
        walletAccounts.id,
        walletAccounts.ownerUserId,
        walletAccounts.type,
        walletAccounts.currency,
        walletAccounts.createdAt,
      )
      .having(
        sql`
          coalesce(sum(case when ${ledgerEntries.side} = 'credit' then ${ledgerEntries.amountMinor} else -${ledgerEntries.amountMinor} end), 0) < 0
        `,
      )
      .limit(Math.min(inputLimit(limit), 100));

    return rows.map(
      (row): NegativeWalletBalance => ({
        walletAccountId: row.walletAccountId,
        ownerUserId: row.ownerUserId,
        walletAccountType: row.walletAccountType,
        currency: row.currency,
        balanceMinor: row.balanceMinor,
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }
}

function inputLimit(limit: number) {
  return Number.isInteger(limit) && limit > 0 ? limit : 25;
}
