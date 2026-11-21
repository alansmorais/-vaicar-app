package app.vaicar.data

import app.vaicar.geo.GeoPoint

data class ApiErrorPayload(
    val code: String? = null,
    val message: String? = null
)

data class ApiEnvelope<T>(
    val success: Boolean = false,
    val data: T? = null,
    val error: ApiErrorPayload? = null,
    val message: String? = null,
    val status: String? = null,
    val market: String? = null,
    val requestId: String? = null
)

data class HealthPayload(
    val status: String = "",
    val market: String? = null,
    val requestId: String? = null
)

// --- Auth & Profiles ---

data class LoginRequest(val email: String, val password: String)
data class ForgotPasswordRequest(val email: String)
data class ResetPasswordRequest(val email: String, val pin: String, val newPassword: String)
data class ResetPasswordResponse(
    val success: Boolean = false,
    val token: String? = null,
    val message: String? = null,
    val error: ApiErrorPayload? = null
)

data class LoginResponse(
    val success: Boolean = false,
    val token: String? = null,
    val customToken: String? = null,
    val user: UserPayload? = null,
    val passenger: PassengerProfileDto? = null,
    val driver: DriverProfileDto? = null,
    val roles: List<String> = emptyList(),
    val isAdmin: Boolean = false,
    val message: String? = null,
    val error: ApiErrorPayload? = null
)

data class RegisterPassengerRequest(
    val uid: String,
    val name: String,
    val whatsapp: String,
    val email: String,
    val photoUrl: String,
    val termsAccepted: Boolean = true,
    val referralCode: String? = null
)

data class RegisterDriverRequest(
    val uid: String,
    val name: String,
    val cpf: String,
    val birthDate: String,
    val whatsapp: String,
    val email: String,
    val photoUrl: String,
    val professionalCategory: String,
    val cnhNumber: String,
    val subscriptionPlan: String = "monthly_100",
    val servicesOffered: List<String> = listOf("ride"),
    val vehicle: VehicleDto,
    val operatingZones: List<String> = listOf("Centro & Porto Grande")
)

data class RegisterResponseData(
    val user: UserPayload? = null,
    val passenger: PassengerProfileDto? = null,
    val driver: DriverProfileDto? = null,
    val emailStatus: String? = null
)

data class UserPayload(
    val uid: String? = null,
    val email: String? = null,
    val displayName: String? = null,
    val role: String? = null,
    val whatsapp: String? = null,
    val photoUrl: String? = null,
    val isAdmin: Boolean? = null,
    val isDriver: Boolean? = null,
    val isPassenger: Boolean? = null
)

data class ProfilePayload(
    val user: UserPayload? = null,
    val passenger: PassengerProfileDto? = null,
    val driver: DriverProfileDto? = null,
    val isAdmin: Boolean = false
)

data class PassengerProfileDto(
    val uid: String = "",
    val name: String = "",
    val email: String = "",
    val whatsapp: String = "",
    val photoUrl: String = "",
    val rating: Double? = 5.0,
    val totalRides: Int? = 0,
    val isBlocked: Boolean? = false,
    val blockedReason: String? = null,
    val referralCode: String? = null,
    val referralCreditBalance: Double? = 0.0
)

data class UpdatePassengerRequest(
    val name: String? = null,
    val whatsapp: String? = null
)

data class VehicleDto(
    val type: String? = "car",
    val brand: String = "",
    val make: String? = null,
    val model: String = "",
    val year: Int = 2022,
    val color: String = "",
    val plate: String = ""
)

data class DriverLocationDto(
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val heading: Double? = null,
    val speed: Double? = null,
    val accuracy: Double? = null,
    val updatedAt: String? = null,
    val distanceKm: Double? = null,
    val etaMinutes: Int? = null,
    val isStale: Boolean? = null,
    val secondsAgo: Int? = null
)

data class DriverProfileDto(
    val uid: String = "",
    val name: String = "",
    val cpf: String? = null,
    val email: String = "",
    val whatsapp: String = "",
    val photoUrl: String? = null,
    val cnhNumber: String? = null,
    val professionalCategory: String? = null,
    val subscriptionPlan: String? = null,
    val vehicle: VehicleDto? = null,
    val operatingZones: List<String> = emptyList(),
    val status: String = "PENDING_APPROVAL",
    val rejectionReason: String? = null,
    val isOnline: Boolean = false,
    val currentLocation: DriverLocationDto? = null,
    val rating: Double = 5.0,
    val completedRidesCount: Int = 0
)

data class PublicDriverMarkerDto(
    val uid: String = "",
    val name: String = "",
    val vehicle: VehicleDto? = null,
    val currentLocation: DriverLocationDto? = null,
    val rating: Double = 5.0,
    val isCourier: Boolean? = null
)

// --- Rides & Offers ---

data class LocationPointDto(
    val address: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0
)

data class EstimateRideRequest(
    val origin: LocationPointDto,
    val destination: LocationPointDto,
    val serviceType: String = "ride"
)

data class DriverRideOptionDto(
    val driverId: String = "",
    val name: String = "",
    val rating: Double = 5.0,
    val vehicle: VehicleDto? = null,
    val distanceToPickupKm: Double = 0.0,
    val etaMinutes: Int = 5,
    val fareAmount: Double = 0.0
)

data class EstimateRideResultDto(
    val distanceKm: Double = 0.0,
    val durationMinutes: Int = 0,
    val fareAmount: Double = 0.0,
    val originalFareAmount: Double? = null,
    val discountApplied: Boolean? = false,
    val availableDrivers: List<DriverRideOptionDto> = emptyList()
)

data class RequestRidePayload(
    val origin: LocationPointDto,
    val destination: LocationPointDto,
    val paymentMethod: String = "PIX",
    val requestedDriverId: String? = null,
    val serviceType: String = "ride"
)

data class RideDto(
    val id: String = "",
    val serviceType: String? = "ride",
    val passengerId: String = "",
    val passengerName: String = "",
    val passengerPhone: String = "",
    val driverId: String? = null,
    val driverName: String? = null,
    val driverPhone: String? = null,
    val vehicle: VehicleDto? = null,
    val origin: LocationPointDto = LocationPointDto(),
    val destination: LocationPointDto = LocationPointDto(),
    val distanceKm: Double = 0.0,
    val durationMinutes: Int = 0,
    val fareAmount: Double = 0.0,
    val paymentMethod: String = "PIX",
    val paymentStatus: String = "PENDING",
    val paymentApprovedByDriver: Boolean? = false,
    val status: String = "REQUESTED",
    val requestedAt: String? = null,
    val acceptedAt: String? = null,
    val arrivedAt: String? = null,
    val waitingTimerStartedAt: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val cancelReason: String? = null,
    val ratingByPassenger: Int? = null,
    val ratingByDriver: Int? = null,
    val driverLocation: DriverLocationDto? = null
)

data class RideOfferDto(
    val id: String = "",
    val rideId: String = "",
    val driverId: String = "",
    val status: String = "PENDING",
    val expiresAt: String = "",
    val secondsRemaining: Int? = null,
    val distanceKm: Double = 0.0,
    val fareAmount: Double = 0.0,
    val origin: LocationPointDto = LocationPointDto(),
    val destination: LocationPointDto = LocationPointDto(),
    val passengerName: String = "",
    val passengerPhone: String = "",
    val serviceType: String = "ride"
)

data class ToggleOnlineRequest(val isOnline: Boolean)
data class ToggleOnlineResponse(val isOnline: Boolean = false, val status: String = "")

data class UpdateDriverLocationRequest(
    val lat: Double,
    val lng: Double,
    val heading: Double = 0.0,
    val speed: Double? = null,
    val accuracy: Double? = null
)

data class RideDriverLocationResponse(
    val success: Boolean = false,
    val hasLiveLocation: Boolean = false,
    val status: String? = null,
    val arrivedAt: String? = null,
    val driverLocation: DriverLocationDto? = null
)

data class CancelRideRequest(val reason: String, val isEmergency: Boolean = false)
data class CompleteRideRequest(val paymentApproved: Boolean = true)
data class CompleteRideData(val ride: RideDto? = null)
data class RateRideRequest(val rating: Int, val feedback: String? = null)

// --- Maps & Routing ---

data class AutocompleteRequest(val input: String)
data class GeocodeRequest(val address: String)
data class ReverseGeocodeRequest(val lat: Double, val lng: Double)

data class PlacePredictionDto(
    val description: String = "",
    val placeId: String? = null,
    val mainText: String? = null,
    val secondaryText: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val inOperationalArea: Boolean? = null
)

data class GeocodeResultDto(
    val address: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0
)

/**
 * Matches GET /api/v1/maps/directions raw JSON payload (and optional wrapped envelope).
 */
data class RawDirectionsResponse(
    val distanceKm: Double = 0.0,
    val durationMin: Int = 0,
    val encodedPolyline: String? = null,
    val summary: String? = null,
    val fallback: Boolean? = false,
    val data: RawDirectionsResponse? = null
)

data class DrivingRoute(
    val distanceKm: Double,
    val durationMinutes: Int,
    val coords: List<GeoPoint>,
    val summary: String = "",
    val provider: String = "server"
)
