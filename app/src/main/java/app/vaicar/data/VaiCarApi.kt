package app.vaicar.data

import app.vaicar.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET

data class HealthPayload(
    val status: String,
    val market: String? = null,
    val requestId: String? = null
)

data class ApiEnvelope<T>(
    val success: Boolean,
    val data: T? = null,
    val status: String? = null,
    val market: String? = null,
    val requestId: String? = null
)

interface VaiCarApi {
    @GET("api/v1/health")
    suspend fun health(): ApiEnvelope<HealthPayload>
}

object VaiCarApiClient {
    val service: VaiCarApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(VaiCarApi::class.java)
    }
}
