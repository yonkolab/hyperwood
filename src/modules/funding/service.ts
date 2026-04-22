import { primaryMarketCurrency } from '../../config/currency';
import { ComplianceService } from '../compliance/service';
import { OperationsAlertService } from '../operations/alerts';
import { AdminAuditService } from '../operations/audit';
import { DepositWorkflowService } from './deposit-workflow.service';
import { FundingDelayAlertService } from './funding-delay-alert.service';
import { FundingMethodCatalogService } from './funding-method-catalog.service';
import { FundingReconciliationService } from './funding-reconciliation.service';
import { FundingWalletLedgerService } from './funding-wallet-ledger.service';
import { FundingWebhookWorkflowService } from './funding-webhook-workflow.service';
import type {
  CreateDepositInput,
  CreateWithdrawalInput,
  LinkFundingMethodInput,
  MarketCurrency,
  ProcessProviderFundingWebhookInput,
  ReconciliationSnapshotInput,
  SeedWalletBalanceInput,
} from './types';
import { WithdrawalWorkflowService } from './withdrawal-workflow.service';

export class FundingService {
  private readonly complianceService = new ComplianceService();
  private readonly adminAuditService = new AdminAuditService();
  private readonly operationsAlertService = new OperationsAlertService();
  private readonly walletLedgerService = new FundingWalletLedgerService();
  private readonly fundingMethodCatalogService =
    new FundingMethodCatalogService(
      this.walletLedgerService,
      this.complianceService,
    );
  private readonly depositWorkflowService = new DepositWorkflowService(
    this.walletLedgerService,
    this.complianceService,
  );
  private readonly withdrawalWorkflowService = new WithdrawalWorkflowService(
    this.walletLedgerService,
    this.complianceService,
    this.adminAuditService,
  );
  private readonly fundingWebhookWorkflowService =
    new FundingWebhookWorkflowService(this.walletLedgerService);
  private readonly fundingReconciliationService =
    new FundingReconciliationService(
      this.walletLedgerService,
      this.operationsAlertService,
    );
  private readonly fundingDelayAlertService = new FundingDelayAlertService(
    this.operationsAlertService,
  );

  async linkFundingMethod(input: LinkFundingMethodInput) {
    return this.fundingMethodCatalogService.linkFundingMethod(input);
  }

  async listEligibleFundingMethods(
    userId: string,
    currency: MarketCurrency = primaryMarketCurrency,
  ) {
    return this.fundingMethodCatalogService.listEligibleFundingMethods(
      userId,
      currency,
    );
  }

  async getWalletBalance(
    userId: string,
    currency: MarketCurrency = primaryMarketCurrency,
  ) {
    return this.walletLedgerService.getWalletBalance(userId, currency);
  }

  async listDeposits(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    return this.depositWorkflowService.listDeposits(userId, input);
  }

  async createDeposit(input: CreateDepositInput) {
    return this.depositWorkflowService.createDeposit(input);
  }

  async listWithdrawals(
    userId: string,
    input: {
      currency?: MarketCurrency;
      limit: number;
    },
  ) {
    return this.withdrawalWorkflowService.listWithdrawals(userId, input);
  }

  async createWithdrawal(input: CreateWithdrawalInput) {
    return this.withdrawalWorkflowService.createWithdrawal(input);
  }

  async processProviderFundingWebhook(
    input: ProcessProviderFundingWebhookInput,
  ) {
    return this.fundingWebhookWorkflowService.processProviderFundingWebhook(
      input,
    );
  }

  async scanDelayedProviderCallbacks(input: {
    limit: number;
    provider?: string;
  }) {
    return this.fundingDelayAlertService.scanDelayedProviderCallbacks(input);
  }

  async seedWalletBalance(input: SeedWalletBalanceInput) {
    return this.walletLedgerService.seedWalletBalance(input);
  }

  async settleDeposit(depositId: string) {
    return this.depositWorkflowService.settleDeposit(depositId);
  }

  async approveWithdrawalReview(withdrawalId: string) {
    return this.withdrawalWorkflowService.approveWithdrawalReview(withdrawalId);
  }

  async failWithdrawal(withdrawalId: string, failureReason: string) {
    return this.withdrawalWorkflowService.failWithdrawal(
      withdrawalId,
      failureReason,
    );
  }

  async settleWithdrawal(withdrawalId: string) {
    return this.withdrawalWorkflowService.settleWithdrawal(withdrawalId);
  }

  async runTransferReconciliation(input: {
    provider?: string;
    snapshots: ReconciliationSnapshotInput[];
  }) {
    return this.fundingReconciliationService.runTransferReconciliation(input);
  }

  async listReconciliationDiscrepancies(input: {
    unresolvedOnly: boolean;
    limit: number;
  }) {
    return this.fundingReconciliationService.listReconciliationDiscrepancies(
      input,
    );
  }
}
