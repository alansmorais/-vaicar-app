package app.vaicar.data

import android.content.Context
import android.content.SharedPreferences
import app.vaicar.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

object VaiCarSession {
    @Volatile var token: String? = null
    @Volatile var email: String? = null
    @Volatile var displayName: String? = null
    @Volatile var role: String? = null

    private const val PREFS_NAME = "vaicar_session_prefs"
    private const val KEY_TOKEN = "token"
    private const val KEY_EMAIL = "email"
    private const val KEY_NAME = "display_name"
    private const val KEY_ROLE = "role"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun restore(context: Context) {
        val p = prefs(context)
        token = p.getString(KEY_TOKEN, null)
        email = p.getString(KEY_EMAIL, null)
        displayName = p.getString(KEY_NAME, null)
        role = p.getString(KEY_ROLE, null)
    }

    fun save(context: Context, token: String, email: String?, displayName: String?, role: String?) {
        this.token = token
        this.email = email
        this.displayName = displayName
        this.role = role
        prefs(context).edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_EMAIL, email)
            .putString(KEY_NAME, displayName)
            .putString(KEY_ROLE, role)
            .apply()
    }

    fun clear(context: Context? = null) {
        token = null
        email = null
        displayName = null
        role = null
        context?.let { prefs(it).edit().clear().apply() }
    }
}

interface VaiCarApi {
    @GET("api/v1/health")
    suspend fun health(): ApiEnvelope<HealthPayload>

    // Auth
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @POST("api/v1/auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): ApiEnvelope<Map<String, Any>>

    @POST("api/v1/auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): ResetPasswordResponse

    @GET("api/v1/auth/me")
    suspend fun me(): ApiEnvelope<ProfilePayload>

    @POST("api/v1/auth/register-passenger")
    suspend fun registerPassenger(@Body request: RegisterPassengerRequest): ApiEnvelope<RegisterResponseData>

    @POST("api/v1/auth/register-driver")
    suspend fun registerDriver(@Body request: RegisterDriverRequest): ApiEnvelope<RegisterResponseData>

    // Passenger
    @GET("api/v1/passengers/me")
    suspend fun passengerMe(): ApiEnvelope<PassengerProfileDto>

    @PATCH("api/v1/passengers/me")
    suspend fun updatePassengerMe(@Body request: UpdatePassengerRequest): ApiEnvelope<PassengerProfileDto>

    @GET("api/v1/passengers/active-ride")
    suspend fun passengerActiveRide(): ApiEnvelope<RideDto?>

    @GET("api/v1/passengers/rides")
    suspend fun passengerRides(): ApiEnvelope<List<RideDto>>

    // Drivers
    @GET("api/v1/drivers/online")
    suspend fun onlineDrivers(): ApiEnvelope<List<PublicDriverMarkerDto>>

    @GET("api/v1/drivers/me")
    suspend fun driverMe(): ApiEnvelope<DriverProfileDto>

    @POST("api/v1/drivers/toggle-online")
    suspend fun toggleOnline(@Body request: ToggleOnlineRequest): ApiEnvelope<ToggleOnlineResponse>

    @POST("api/v1/drivers/location")
    suspend fun updateDriverLocation(@Body request: UpdateDriverLocationRequest): ApiEnvelope<DriverLocationDto>

    @GET("api/v1/drivers/offers/pending")
    suspend fun pendingOffer(): ApiEnvelope<RideOfferDto?>

    @POST("api/v1/drivers/offers/{offerId}/accept")
    suspend fun acceptOffer(@Path("offerId") offerId: String): ApiEnvelope<RideDto>

    @POST("api/v1/drivers/offers/{offerId}/decline")
    suspend fun declineOffer(@Path("offerId") offerId: String): ApiEnvelope<Map<String, Any>>

    @GET("api/v1/drivers/active-ride")
    suspend fun driverActiveRide(): ApiEnvelope<RideDto?>

    @GET("api/v1/drivers/rides")
    suspend fun driverRides(): ApiEnvelope<List<RideDto>>

    // Rides
    @POST("api/v1/rides/estimate")
    suspend fun estimateRide(@Body request: EstimateRideRequest): ApiEnvelope<EstimateRideResultDto>

    @POST("api/v1/rides/request")
    suspend fun requestRide(@Body request: RequestRidePayload): ApiEnvelope<RideDto>

    @GET("api/v1/rides/{rideId}")
    suspend fun getRide(@Path("rideId") rideId: String): ApiEnvelope<RideDto>

    @GET("api/v1/rides/{rideId}/driver-location")
    suspend fun getRideDriverLocation(@Path("rideId") rideId: String): RideDriverLocationResponse

    @POST("api/v1/rides/{rideId}/driver-location")
    suspend fun postRideDriverLocation(
        @Path("rideId") rideId: String,
        @Body request: UpdateDriverLocationRequest
    ): RideDriverLocationResponse

    @POST("api/v1/rides/{rideId}/arrived")
    suspend fun markArrived(@Path("rideId") rideId: String): ApiEnvelope<RideDto>

    @POST("api/v1/rides/{rideId}/start")
    suspend fun startRide(@Path("rideId") rideId: String): ApiEnvelope<RideDto>

    @POST("api/v1/rides/{rideId}/complete")
    suspend fun completeRide(
        @Path("rideId") rideId: String,
        @Body request: CompleteRideRequest
    ): ApiEnvelope<CompleteRideData>

    @POST("api/v1/rides/{rideId}/approve-payment")
    suspend fun approvePayment(@Path("rideId") rideId: String): ApiEnvelope<CompleteRideData>

    @POST("api/v1/rides/{rideId}/cancel")
    suspend fun cancelRide(
        @Path("rideId") rideId: String,
        @Body request: CancelRideRequest
    ): ApiEnvelope<RideDto>

    @POST("api/v1/rides/{rideId}/rate")
    suspend fun rateDriver(
        @Path("rideId") rideId: String,
        @Body request: RateRideRequest
    ): ApiEnvelope<RideDto>

    @POST("api/v1/rides/{rideId}/rate-passenger")
    suspend fun ratePassenger(
        @Path("rideId") rideId: String,
        @Body request: RateRideRequest
    ): ApiEnvelope<RideDto>

    // Maps
    @POST("api/v1/maps/autocomplete")
    suspend fun autocomplete(@Body request: AutocompleteRequest): ApiEnvelope<List<PlacePredictionDto>>

    @POST("api/v1/maps/geocode")
    suspend fun geocode(@Body request: GeocodeRequest): ApiEnvelope<GeocodeResultDto>

    @POST("api/v1/maps/reverse-geocode")
    suspend fun reverseGeocode(@Body request: ReverseGeocodeRequest): ApiEnvelope<GeocodeResultDto>

    @GET("api/v1/maps/directions")
    suspend fun directions(
        @Query("originLat") originLat: Double,
        @Query("originLng") originLng: Double,
        @Query("destLat") destLat: Double,
        @Query("destLng") destLng: Double
    ): RawDirectionsResponse
}

object VaiCarApiClient {
    @Volatile
    private var overrideService: VaiCarApi? = null

    val httpClient: OkHttpClient by lazy {
        val authInterceptor = Interceptor { chain ->
            val request = chain.request().newBuilder().apply {
                header("Accept", "application/json")
                VaiCarSession.token?.let { header("Authorization", "Bearer $it") }
            }.build()
            chain.proceed(request)
        }
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val defaultService: VaiCarApi by lazy {
        createForBaseUrl(BuildConfig.API_BASE_URL)
    }

    val service: VaiCarApi
        get() = overrideService ?: defaultService

    fun createForBaseUrl(baseUrl: String, client: OkHttpClient = httpClient): VaiCarApi {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(VaiCarApi::class.java)
    }

    fun setTestOverride(api: VaiCarApi?) {
        overrideService = api
    }
}
