package app.vaicar.geo

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class GpsTrackerStatus {
    IDLE,
    PERMISSION_REQUIRED,
    ACQUIRING,
    ACTIVE,
    LOW_ACCURACY,
    SIGNAL_LOST,
    ERROR
}

data class GpsTrackerState(
    val status: GpsTrackerStatus = GpsTrackerStatus.IDLE,
    val sample: GpsSample? = null,
    val errorMessage: String? = null,
    val hasPermission: Boolean = false
)

/**
 * Real Android GPS tracker using FusedLocationProviderClient with LocationManager fallback.
 *
 * - Strictly respects ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION runtime permissions.
 * - Filters every fix through GeoNavigationEngine.filterGpsSample to reject jumps/jitter.
 * - NEVER fabricates or falls back to a fake center coordinate.
 */
class LocationTracker(context: Context) {
    private val appContext = context.applicationContext
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(appContext)

    private val _state = MutableStateFlow(GpsTrackerState(hasPermission = hasLocationPermission()))
    val state: StateFlow<GpsTrackerState> = _state.asStateFlow()

    private var lastAcceptedSample: GpsSample? = null
    private var activeCallback: LocationCallback? = null
    private var legacyListener: LocationListener? = null
    private var tracking = false

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun refreshPermissionState() {
        val granted = hasLocationPermission()
        _state.value = _state.value.copy(
            hasPermission = granted,
            status = if (!granted) GpsTrackerStatus.PERMISSION_REQUIRED else _state.value.status
        )
    }

    @SuppressLint("MissingPermission")
    fun start() {
        val granted = hasLocationPermission()
        if (!granted) {
            _state.value = GpsTrackerState(
                status = GpsTrackerStatus.PERMISSION_REQUIRED,
                sample = lastAcceptedSample,
                errorMessage = "Permita o acesso à localização do dispositivo para usar o mapa em tempo real.",
                hasPermission = false
            )
            return
        }
        if (tracking) return
        tracking = true

        _state.value = _state.value.copy(
            status = if (lastAcceptedSample == null) GpsTrackerStatus.ACQUIRING else _state.value.status,
            errorMessage = null,
            hasPermission = true
        )

        // Seed quickly with last known real fix if recent (< 60s)
        try {
            fusedClient.lastLocation.addOnSuccessListener { location ->
                if (location != null && (System.currentTimeMillis() - location.time) <= GeoNavigationEngine.GPS_FRESHNESS_MAX_AGE_MS) {
                    handleIncomingLocation(location)
                }
            }
        } catch (_: Exception) {
            // Continue with active updates
        }

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2_500L)
            .setMinUpdateIntervalMillis(1_500L)
            .setWaitForAccurateLocation(false)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                handleIncomingLocation(loc)
            }
        }

        try {
            activeCallback = callback
            fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
        } catch (ex: Exception) {
            // Fallback to Android LocationManager on devices without Play Services
            startLegacyLocationManager(ex.message)
        }
    }

    @SuppressLint("MissingPermission")
    private fun startLegacyLocationManager(previousError: String?) {
        val lm = appContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (lm == null) {
            _state.value = _state.value.copy(
                status = GpsTrackerStatus.ERROR,
                errorMessage = previousError ?: "Serviço de GPS indisponível neste dispositivo."
            )
            return
        }
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                handleIncomingLocation(location)
            }
            @Deprecated("Deprecated in Android API")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderDisabled(provider: String) {
                _state.value = _state.value.copy(
                    status = GpsTrackerStatus.SIGNAL_LOST,
                    errorMessage = "GPS desativado nas configurações do aparelho."
                )
            }
        }
        legacyListener = listener
        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2_500L, 2f, listener, Looper.getMainLooper())
            } else if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3_000L, 5f, listener, Looper.getMainLooper())
            } else {
                _state.value = _state.value.copy(
                    status = GpsTrackerStatus.SIGNAL_LOST,
                    errorMessage = "Ative o GPS do aparelho para localizar sua posição real."
                )
            }
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                status = GpsTrackerStatus.ERROR,
                errorMessage = e.message ?: "Erro ao iniciar o GPS."
            )
        }
    }

    fun checkSignalFreshness(nowMs: Long = System.currentTimeMillis()) {
        val sample = lastAcceptedSample ?: return
        if (tracking && (nowMs - sample.timestampMs) > GeoNavigationEngine.GPS_FRESHNESS_MAX_AGE_MS) {
            _state.value = _state.value.copy(
                status = GpsTrackerStatus.SIGNAL_LOST,
                errorMessage = "Sinal de GPS sem atualização há mais de 60 segundos."
            )
        }
    }

    private fun handleIncomingLocation(location: Location) {
        val timestampMs = if (location.time > 0L) location.time else System.currentTimeMillis()
        val incoming = GpsSample(
            lat = location.latitude,
            lng = location.longitude,
            accuracy = if (location.hasAccuracy()) location.accuracy else null,
            heading = if (location.hasBearing()) location.bearing else null,
            speed = if (location.hasSpeed()) location.speed else null,
            timestampMs = timestampMs
        )

        val result = GeoNavigationEngine.filterGpsSample(lastAcceptedSample, incoming)
        if (!result.accepted || result.sample == null) {
            return
        }

        lastAcceptedSample = result.sample
        val lowAccuracy = (result.sample.accuracy ?: 0f) > GeoNavigationEngine.GPS_LOW_ACCURACY_WARNING_METERS
        _state.value = GpsTrackerState(
            status = if (lowAccuracy) GpsTrackerStatus.LOW_ACCURACY else GpsTrackerStatus.ACTIVE,
            sample = result.sample,
            errorMessage = if (lowAccuracy) {
                "Sinal GPS impreciso (±${result.sample.accuracy?.toInt()}m). Aguarde estabilização."
            } else {
                null
            },
            hasPermission = true
        )
    }

    fun stop() {
        tracking = false
        activeCallback?.let {
            try {
                fusedClient.removeLocationUpdates(it)
            } catch (_: Exception) {
            }
        }
        activeCallback = null

        legacyListener?.let { listener ->
            try {
                val lm = appContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                lm?.removeUpdates(listener)
            } catch (_: Exception) {
            }
        }
        legacyListener = null
    }
}
