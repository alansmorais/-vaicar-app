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
  createdAt: string;
  updatedAt: string;
}

export interface PassengerProfile {
  uid: string;
  name: string;
  email: string;
  whatsapp: string;
  photoUrl: string;
  termsAccepted: boolean;
  rating?: number;
  totalRides?: number;
  createdAt: string;
  updatedAt: string;
}

export type DriverApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface VehicleInfo {
  type?: 'car' | 'motorcycle' | 'van';
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
  professionalCategory: string;
  cnhNumber: string;
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentState;
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
