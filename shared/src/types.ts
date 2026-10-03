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
  createdAt: string;
  updatedAt: string;
}

export type DriverApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DriverSubscriptionPlan = 'monthly_100' | 'weekly_percent_10';

export interface VehicleInfo {
  type?: 'car' | 'motorcycle' | 'van' | 'bicycle';
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
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
  criminalRecordUrl?: string;
  criminalRecordStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  subscriptionPlan?: DriverSubscriptionPlan;
  subscriptionPlanSelectedAt?: string;
  nextPlanSwitchAllowedAt?: string;
  vehicle: VehicleInfo;
  operatingZones: string[];
  status: DriverApprovalStatus;
  rejectionReason?: string;
  isOnline: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    updatedAt: string;
  };
  rating: number;
  completedRidesCount: number;
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
  | 'CANCELLED_BY_SYSTEM';

export type PaymentMethod = 'CASH' | 'PIX' | 'CARD_MACHINE';

export type PaymentState = 'PENDING' | 'PAID' | 'CONTESTED' | 'RESOLVED';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
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
  discountAmount?: number;
  discountApplied?: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentState;
  paymentApprovedByDriver?: boolean;
  paymentApprovedAt?: string;
  status: RideStatus;
  requestedAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  waitingTimerStartedAt?: string; // 4-minute wait timer
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: 'passenger' | 'driver' | 'system';
  cancelReason?: string;
  ratingByPassenger?: number;
  feedbackByPassenger?: string;
  ratingByDriver?: number;
  feedbackByDriver?: string;
  receiptId?: string;
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED';
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
  discountAmount?: number;
  discountApplied?: boolean;
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
