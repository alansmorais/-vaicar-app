package app.vaicar.data

import app.vaicar.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Interceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

data class HealthPayload(val status: String, val market: String? = null, val requestId: String? = null)
data class ApiEnvelope<T>(val success: Boolean, val data: T? = null, val status: String? = null, val market: String? = null, val requestId: String? = null)
data class LoginRequest(val email: String, val password: String)
data class LoginResponse(
    val success: Boolean = false,
    val token: String? = null,
    val customToken: String? = null,
    val user: UserPayload? = null,
    val roles: List<String> = emptyList(),
    val isAdmin: Boolean = false,
    val message: String? = null
)
data class UserPayload(val uid: String? = null, val email: String? = null, val displayName: String? = null, val role: String? = null)
data class ProfilePayload(val user: UserPayload? = null, val isAdmin: Boolean = false)

object VaiCarSession {
    @Volatile var token: String? = null
}

interface VaiCarApi {
    @GET("api/v1/health")
    suspend fun health(): ApiEnvelope<HealthPayload>

    // /auth/login currently returns its fields at the top level (not inside data).
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/v1/auth/me")
    suspend fun me(): ApiEnvelope<ProfilePayload>
}

object VaiCarApiClient {
    val service: VaiCarApi by lazy {
        val authInterceptor = Interceptor { chain ->
            val request = chain.request().newBuilder().apply {
                VaiCarSession.token?.let { header("Authorization", "Bearer $it") }
            }.build()
            chain.proceed(request)
        }
        val client = OkHttpClient.Builder().addInterceptor(authInterceptor).build()
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(VaiCarApi::class.java)
    }
}
