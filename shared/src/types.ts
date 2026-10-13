/**
 * Authoritative VaiCar Domain Types
 */

export type UserRole = 'passenger' | 'driver' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string;
  whatsapp?: string;
  isAdmin?: boolean;
  isDriver?: boolean;
  isCourier?: boolean;
  isPassenger?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PassengerProfile {
  uid: string;
  name: string;
  email: string;
  whatsapp: string;
  photoUrl: string;
  idDocumentUrl?: string;
  termsAccepted: boolean;
  hasCriminalRecordCheck?: boolean;
  criminalRecordUrl?: string;
  criminalRecordStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  documentsRequested?: string;
  isBlocked?: boolean;
  blockedReason?: string;
  hasUnpaidDebt?: boolean;
  unpaidAmount?: number;
  rating?: number;
  totalRides?: number;
  referralCode?: string;
  referredByCode?: string;
  referredByPassengerId?: string;
  referralDiscountAvailable?: boolean;
  referralCreditBalance?: number;
  referralCreditRedeemed?: number;
  createdAt: string;
  updatedAt: string;
}

export type ReferralStatus = 'REGISTERED' | 'QUALIFIED' | 'REWARDED';

export interface ReferralRecord {
  id: string; // e.g. "ref_<referredPassengerId>"
  referrerId: string;
  referrerCode: string;
  referrerName?: string;
  referredId: string;
  referredName?: string;
  referredEmail?: string;
  referredPhone?: string;
  status: ReferralStatus;
  discountAmount: number;
  rewardAmount: number;
  rewardStatus?: 'PENDING' | 'AWARDED' | 'REDEEMED';
  qualifyingRideId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PassengerReferralSummary {
  referralCode: string;
  shareUrl: string;
  referralCreditBalance: number;
  referralCreditRedeemed: number;
  referralDiscountAvailable: boolean;
  totalReferrals: number;
  completedReferrals: number;
  referrals: ReferralRecord[];
}

export type ServiceType = 'ride' | 'delivery';

export interface DeliveryDetails {
  recipientName: string;
  recipientPhone: string;
  packageNotes?: string;
}

export type DriverApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DriverSubscriptionPlan = 'monthly_100' | 'weekly_percent_10';

export interface VehicleInfo {
  type?: 'car' | 'motorcycle' | 'van' | 'bicycle';
  brand: string;
  make?: string;
  model: string;
  year: number;
  color: string;
  plate: string;
}

export interface FixedRoutePricing {
  id: string;
  name: string; // e.g. "Centro → Maresias"
  originZone: string; // e.g. "Centro"
  destinationZone: string; // e.g. "Maresias"
  price: number; // e.g. 80.00
}

export interface DriverCustomPricing {
  minimumFare: number;       // Valor mínimo da corrida (e.g. R$ 20.00)
  perKmRate: number;          // Valor por KM (e.g. R$ 2.50)
  perMinuteRate?: number;     // Valor por minuto (opcional, e.g. R$ 0.50)
  allowFixedRoutes?: boolean; // Permitir preço por rota
  fixedRoutes?: FixedRoutePricing[]; // Rotas com preço fixo
  updatedAt?: string;
}

export interface DriverDeliveryPricing {
  minimumDeliveryFee: number;       // Valor mínimo da entrega (e.g. R$ 10.00)
  perKmRate: number;                // Valor por KM da entrega (e.g. R$ 2.00)
  waitingPerMinuteRate?: number;    // Taxa de espera por minuto (e.g. R$ 0.50)
  updatedAt?: string;
}

export interface DriverRideOption {
  driverId: string;
  name: string;
  photoUrl?: string;
  rating: number;
  completedRidesCount: number;
  vehicle: VehicleInfo;
  isCourier?: boolean;
  distanceToPickupKm: number;
  etaMinutes: number;
  fareAmount: number;
  originalFareAmount?: number;
  driverTotalEntitlement?: number;
  platformSubsidyAmount?: number;
  discountApplied?: boolean;
  isFixedRoute?: boolean;
  fixedRouteName?: string;
  serviceType?: ServiceType;
  customPricing?: {
    minimumFare: number;
    perKmRate: number;
    perMinuteRate?: number;
  };
  customDeliveryPricing?: DriverDeliveryPricing;
}

export interface DriverProfile {
  uid: string;
  name: string;
  cpf: string;
  birthDate: string;
  email: string;
  whatsapp: string;
  photoUrl: string;
  cnhUrl?: string;
  crlvUrl?: string;
  proofOfAddressUrl?: string;
  documentsRequested?: string;
  professionalCategory: string;
  cnhNumber: string;
  isCourier?: boolean;
  servicesOffered?: ServiceType[];
  criminalRecordUrl?: string;
  criminalRecordStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  subscriptionPlan?: DriverSubscriptionPlan;
  subscriptionPlanSelectedAt?: string;
  nextPlanSwitchAllowedAt?: string;
  vehicle: VehicleInfo;
  operatingZones: string[];
  customPricing?: DriverCustomPricing;
  customDeliveryPricing?: DriverDeliveryPricing;
  status: DriverApprovalStatus;
  rejectionReason?: string;
  isOnline: boolean;
  fcmToken?: string;
  currentLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    updatedAt: string;
  };
  rating: number;
  completedRidesCount: number;
  pixKey?: string;
  pixKeyType?: 'PHONE' | 'CPF' | 'EMAIL' | 'RANDOM';
  pixName?: string;
  createdAt: string;
  updatedAt: string;
}

export type RideStatus =
  | 'REQUESTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_PASSENGER'
  | 'CANCELLED_BY_DRIVER'
  | 'CANCELLED_BY_SYSTEM'
  | 'CANCELLED_BY_ADMIN';

export type PaymentMethod = 'CASH' | 'PIX' | 'CARD_MACHINE';

export type PaymentState = 'PENDING' | 'PAYMENT_PENDING_DRIVER_CONFIRMATION' | 'PAID' | 'CONTESTED' | 'RESOLVED';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  serviceType?: ServiceType;
  deliveryDetails?: DeliveryDetails;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  passengerPhotoUrl?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPhotoUrl?: string;
  vehicle?: VehicleInfo;
  origin: LocationPoint;
  destination: LocationPoint;
  distanceKm: number;
  durationMinutes: number;
  fareAmount: number;
  originalFareAmount?: number;
  passengerFareAmount?: number;
  driverTotalEntitlement?: number;
  platformSubsidyAmount?: number;
  platformSubsidyStatus?: 'NONE' | 'PENDING_SETTLEMENT' | 'SETTLED' | 'CANCELLED';
  platformSubsidySettledAt?: string;
  discountAmount?: number;
  discountApplied?: boolean;
  referralDiscountApplied?: boolean;
  referralDiscountAmount?: number;
  referralCreditApplied?: boolean;
  referralCreditAmount?: number;
  referralCreditRefunded?: boolean;
  referralCreditRefundedAt?: string;
  fixedRouteApplied?: boolean;
  fixedRouteName?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentState;
  paymentApprovedByDriver?: boolean;
  paymentApprovedAt?: string;
  paymentDeclaredAt?: string;
  driverPixKey?: string;
  driverPixName?: string;
  driverPixKeyType?: string;
  accountStatus?: 'ACTIVE' | 'PAYMENT_REQUIRED';
  status: RideStatus;
  requestedAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  waitingTimerStartedAt?: string; // 4-minute wait timer
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: 'passenger' | 'driver' | 'system' | 'admin' | 'ADMIN';
  cancelReason?: string;
  isEmergencyCancellation?: boolean;
  currentOfferId?: string;
  declinedDriverIds?: string[];
  lastDriverCancelledAt?: string;
  lastDriverCancelReason?: string;
  ratingByPassenger?: number;
  feedbackByPassenger?: string;
  ratingByDriver?: number;
  feedbackByDriver?: string;
  notes?: string;
  receiptId?: string;
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED';
  driverLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    updatedAt?: string;
  };
  driverVehicle?: string;
  driverLicensePlate?: string;
  originZoneId?: string;
  destinationZoneId?: string;
  fareBrl?: number;
  estimatedPrice?: number;
}

export type RideOfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface RideOffer {
  id: string;
  rideId: string;
  driverId: string;
  status: RideOfferStatus;
  createdAt: string;
  expiresAt: string;
  secondsRemaining?: number;
  respondedAt?: string;
  distanceKm: number;
  fareAmount: number;
  originalFareAmount?: number;
  driverTotalEntitlement?: number;
  platformSubsidyAmount?: number;
  origin: LocationPoint;
  destination: LocationPoint;
  passengerName: string;
  passengerPhone: string;
  passengerPhotoUrl?: string;
  serviceType: ServiceType;
  deliveryDetails?: DeliveryDetails;
  notes?: string;
}

export interface Receipt {
  id: string;
  rideId: string;
  receiptNumber: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  driverName: string;
  vehicleDescription: string;
  vehiclePlate: string;
  dateTime: string;
  originAddress: string;
  destinationAddress: string;
  distanceKm: number;
  durationMinutes: number;
  fareAmount: number;
  originalFareAmount?: number;
  passengerFareAmount?: number;
  driverTotalEntitlement?: number;
  platformSubsidyAmount?: number;
  platformSubsidyStatus?: 'NONE' | 'PENDING_SETTLEMENT' | 'SETTLED' | 'CANCELLED';
  platformSubsidySettledAt?: string;
  discountAmount?: number;
  discountApplied?: boolean;
  referralDiscountApplied?: boolean;
  referralDiscountAmount?: number;
  referralCreditApplied?: boolean;
  referralCreditAmount?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentState;
  generatedAt: string;
}

export interface PlatformPricingSettings {
  baseFare: number;       // e.g. R$ 7.00
  perKmRate: number;      // e.g. R$ 3.50/km
  perMinuteRate: number;  // e.g. R$ 0.50/min
  minimumFare: number;    // e.g. R$ 12.00
  nightSurchargeMultiplier: number; // e.g. 1.20
  deliveryMinimumFee?: number; // e.g. R$ 10.00
  deliveryPerKmRate?: number;  // e.g. R$ 2.00
  deliveryWaitingPerMinuteRate?: number; // e.g. R$ 0.50
  updatedAt: string;
}

export interface AdminMetrics {
  totalRides: number;
  completedRides: number;
  activeOnlineDrivers: number;
  pendingDriverApprovals: number;
  totalPassengers: number;
  totalDrivers: number;
  grossVolumeBRL: number;
  // Phase 1 — Stage 4 additions
  totalPassengerRides?: number;
  totalDeliveries?: number;
  completedPassengerRides?: number;
  completedDeliveries?: number;
  activeOnlineRideDrivers?: number;
  activeOnlineDeliveryPartners?: number;
  grossVolumeRidesBRL?: number;
  grossVolumeDeliveriesBRL?: number;
  totalPlatformSubsidyLiabilityBRL?: number;
  pendingSubsidyCount?: number;
  settledSubsidyAmountBRL?: number;
}

export type ReportCategory =
  | 'UNPAID_FARE'        // Passageiro não pagou a corrida (calote)
  | 'OVERCHARGING'       // Cobrança indevida
  | 'DANGEROUS_DRIVING'  // Direção perigosa
  | 'VEHICLE_ISSUE'      // Problema com veículo
  | 'MISCONDUCT'         // Mau comportamento
  | 'NO_SHOW'            // Não compareceu
  | 'OTHER';             // Outro

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
  id: string;
  rideId?: string;
  reporterRole: 'driver' | 'passenger';
  reporterId: string;
  reporterName: string;
  reporterPhone?: string;
  targetRole: 'driver' | 'passenger';
  targetId: string;
  targetName: string;
  category: ReportCategory;
  description: string;
  unpaidAmount?: number;
  status: ReportStatus;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateReportInput {
  rideId?: string;
  category: ReportCategory;
  description: string;
  unpaidAmount?: number;
  targetUserId?: string;
}

export type ApkAppType = 'passenger' | 'driver';

export interface ApkDailyDownloadStat {
  date: string;
  passenger: number;
  driver: number;
  total: number;
}

export interface ApkDownloadSummary {
  totalPassengerDownloads: number;
  totalDriverDownloads: number;
  totalDownloads: number;
  lastPassengerDownloadAt?: string | null;
  lastDriverDownloadAt?: string | null;
  lastDownloadAt?: string | null;
  trackingStartedAt: string;
}

export interface ApkDownloadAnalyticsResponse {
  summary: ApkDownloadSummary;
  last7Days: ApkDailyDownloadStat[];
  last30Days: ApkDailyDownloadStat[];
  notice: string;
}

export type DeliveryWaitlistRole = 'courier_motorcycle' | 'courier_bicycle' | 'merchant' | 'consumer';

export interface DeliveryWaitlistEntry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: DeliveryWaitlistRole;
  vehicleDetails?: string;
  neighborhood?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateDeliveryWaitlistInput {
  name: string;
  phone: string;
  email?: string;
  role: DeliveryWaitlistRole;
  vehicleDetails?: string;
  neighborhood?: string;
  notes?: string;
}

