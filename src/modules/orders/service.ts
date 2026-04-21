import { ComplianceService } from '../compliance/service';
import { ExchangeService } from '../exchange/service';
import { OrderAmendmentService } from './order-amendment.service';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderCommandEventService } from './order-command-event.service';
import { OrderEntryService } from './order-entry.service';
import { OrderLedgerReservationService } from './order-ledger-reservation.service';
import type { CreateOrderInput } from './types';

export class OrdersService {
  private readonly complianceService = new ComplianceService();
  private readonly exchangeService = new ExchangeService();
  private readonly orderLedgerReservationService =
    new OrderLedgerReservationService();
  private readonly orderCommandEventService = new OrderCommandEventService();
  private readonly orderEntryService = new OrderEntryService(
    this.complianceService,
    this.exchangeService,
    this.orderLedgerReservationService,
    this.orderCommandEventService,
  );
  private readonly orderCancellationService = new OrderCancellationService(
    this.orderLedgerReservationService,
    this.orderCommandEventService,
  );
  private readonly orderAmendmentService = new OrderAmendmentService(
    this.exchangeService,
    this.orderLedgerReservationService,
    this.orderCommandEventService,
  );

  async createOrder(input: CreateOrderInput) {
    return this.orderEntryService.createOrder(input);
  }

  async cancelOrder(input: { userId: string; orderId: string }) {
    return this.orderCancellationService.cancelOrder(input);
  }

  async amendOrder(input: {
    userId: string;
    orderId: string;
    quantity?: number;
    limitPriceBps?: number;
  }) {
    return this.orderAmendmentService.amendOrder(input);
  }
}
