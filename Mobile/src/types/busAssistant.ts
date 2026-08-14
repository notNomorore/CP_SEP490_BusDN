export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type ValidateTicketPayload = {
  qrCode?: string;
  qrPayload?: string;
  code?: string;
  ticketCode?: string;
  tripId?: string;
  routeId?: string;
  routeCode?: string;
  vehicleId?: string;
  serviceDate?: string;
  departureTime?: string;
  direction?: string;
};

export type TicketValidationResult = {
  ok?: boolean;
  result?: string;
  status?: string;
  validationStatus?: string;
  message?: string;
  ticketCode?: string;
  passCode?: string;
  passengerName?: string;
  routeCode?: string;
  routeNumber?: string;
  tripId?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  usedAt?: string | null;
  ticketType?: string;
  ticketInfo?: {
    _id?: string;
    ticketCode?: string;
    passCode?: string;
    ticketType?: string;
    passengerType?: string;
    passengerQuantity?: number;
    status?: string;
    amount?: number;
    ticketPrice?: number;
    routeCode?: string;
    routeNumber?: string;
    tripId?: string;
    departureLocation?: string;
    destinationLocation?: string;
    fromStop?: string;
    toStop?: string;
    validFrom?: string | null;
    validUntil?: string | null;
    expiresAt?: string | null;
    usedAt?: string | null;
  };
  passengerInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  routeInfo?: {
    routeCode?: string;
    routeName?: string;
    name?: string;
  } | null;
};

export type WalkInTicketPayload = {
  routeId: string;
  tripId: string;
  fromStopId: string;
  toStopId: string;
  passengerType: string;
  passengerQuantity: number;
  ticketType: string;
  paymentMethod: string;
  amount: number;
  cashReceived?: number;
  changeAmount?: number;
};

export type WalkInTicketResult = {
  ticketData?: {
    _id?: string;
    ticketCode?: string;
    passengerCount?: number;
    totalAmount?: number;
    paymentMethod?: string;
    status?: string;
  };
  transactionData?: {
    transactionCode?: string;
    paymentMethod?: string;
    finalAmount?: number;
  };
  totalAmount?: number;
  qrCodeImage?: string | null;
  checkoutUrl?: string | null;
  requiresPaymentConfirmation?: boolean;
  paymentCompleted?: boolean;
  confirmed?: boolean;
  resumed?: boolean;
  cashReceived?: number | null;
  changeAmount?: number;
  message?: string;
};

export type WalkInTicketHistoryItem = {
  _id: string;
  ticketCode?: string;
  issuedAt?: string;
  routeCode?: string;
  routeName?: string;
  tripId?: string;
  passengerCount?: number;
  paymentMethod?: string;
  totalAmount?: number;
  collectedAmount?: number;
  status?: string;
  canResumePayment?: boolean;
};

export type WalkInTicketHistory = {
  date: string;
  count: number;
  totalRevenue: number;
  tickets: WalkInTicketHistoryItem[];
};

export type ShiftRevenue = {
  shiftInfo?: {
    _id?: string;
    shiftCode?: string;
    shiftName?: string;
    status?: string;
    workDate?: string | null;
  };
  totalTicketsSold?: number;
  totalRevenue?: number;
  cashCollected?: number;
  ePaymentAmount?: number;
  discountAmount?: number;
  validatedETickets?: number;
  revenueBreakdown?: Array<{
    ticketType: string;
    tickets: number;
    revenue: number;
    discountAmount?: number;
  }>;
  paymentMethodBreakdown?: Array<{
    paymentMethod: string;
    transactions: number;
    amount: number;
  }>;
  recentTransactions?: Array<{
    _id: string;
    transactionCode?: string;
    ticketType?: string;
    paymentMethod?: string;
    amount?: number;
    status?: string;
    completedAt?: string;
  }>;
};

export type RevenueSummaryResult = {
  systemAmount?: number;
  actualCollectedAmount?: number;
  differenceAmount?: number;
  reconciliationStatus?: string;
  message?: string;
};

export type ValidationHistoryPayload = {
  date: string;
  count: number;
  validations: Array<TicketValidationResult & {
    savedAt?: string;
    savedDate?: string;
  }>;
};
