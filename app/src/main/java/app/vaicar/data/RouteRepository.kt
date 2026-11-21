package app.vaicar.data

import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Real road routing & São Sebastião address search repository.
 *
 * Strictly enforces:
 * - Real road geometry ONLY (server Google/OSRM -> direct OSRM GeoJSON fallback).
 * - NEVER fabricates straight-line routes or fake coordinates.
 * - Filters out legacy preset IDs (loc-*, custom-*) so passengers always use real search.
 */
object RouteRepository {

    @Volatile
    var osrmBaseUrl: String = "https://router.project-osrm.org"

    @Volatile
    var nominatimBaseUrl: String = "https://nominatim.openstreetmap.org"

    private val externalClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private fun isSyntheticPreset(placeId: String?): Boolean {
        if (placeId.isNullOrBlank()) return false
        return placeId.startsWith("loc-", ignoreCase = true) ||
            placeId.startsWith("custom-", ignoreCase = true)
    }

    suspend fun getDrivingRoute(
        origin: GeoPoint,
        destination: GeoPoint,
        api: VaiCarApi = VaiCarApiClient.service
    ): DrivingRoute = withContext(Dispatchers.IO) {
        if (!GeoNavigationEngine.isValidCoordinate(origin.lat, origin.lng) ||
            !GeoNavigationEngine.isValidCoordinate(destination.lat, destination.lng)
        ) {
            throw IllegalArgumentException("Coordenadas inválidas para cálculo de rota.")
        }

        // 1. Primary: Existing VaiCar backend /api/v1/maps/directions (Google Directions / server OSRM)
        try {
            val raw = api.directions(
                originLat = origin.lat,
                originLng = origin.lng,
                destLat = destination.lat,
                destLng = destination.lng
            )
            val payload = raw.data ?: raw
            val isFallback = payload.fallback == true
            val decoded = if (!isFallback) {
                GeoNavigationEngine.decodePolyline(payload.encodedPolyline)
            } else {
                emptyList()
            }

            if (decoded.size >= 2) {
                val distKm = if (payload.distanceKm > 0.0) {
                    payload.distanceKm
                } else {
                    (GeoNavigationEngine.calculatePolylineDistanceMeters(decoded) / 100.0).roundToInt() / 10.0
                }
                val durMin = if (payload.durationMin > 0) {
                    payload.durationMin
                } else {
                    max(1, (distKm * 2.1).roundToInt())
                }
                return@withContext DrivingRoute(
                    distanceKm = distKm,
                    durationMinutes = durMin,
                    coords = decoded,
                    summary = payload.summary.orEmpty(),
                    provider = "server"
                )
            }
        } catch (_: Exception) {
            // Fall through to real road OSRM fallback
        }

        // 2. Fallback: Real road geometry via OSRM (NEVER straight line)
        val url = "${osrmBaseUrl.trimEnd('/')}/route/v1/driving/" +
            "${origin.lng},${origin.lat};${destination.lng},${destination.lat}" +
            "?overview=full&geometries=geojson"

        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", "VaiCarAndroid/2.0 (SaoSebastiao)")
            .build()

        externalClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("Não foi possível calcular a rota viária no momento.")
            }
            val bodyStr = response.body?.string().orEmpty()
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val routes = root.getAsJsonArray("routes")
            if (routes == null || routes.size() == 0) {
                throw IllegalStateException("Nenhuma rota viária encontrada entre os pontos informados.")
            }
            val route = routes[0].asJsonObject
            val geometry = route.getAsJsonObject("geometry")
            val coordinates = geometry?.getAsJsonArray("coordinates")
            val points = mutableListOf<GeoPoint>()
            if (coordinates != null) {
                for (el in coordinates) {
                    val pair = el.asJsonArray
                    if (pair.size() >= 2) {
                        val lng = pair[0].asDouble
                        val lat = pair[1].asDouble
                        if (GeoNavigationEngine.isValidCoordinate(lat, lng)) {
                            points.add(GeoPoint(lat = lat, lng = lng))
                        }
                    }
                }
            }
            if (points.size < 2) {
                throw IllegalStateException("Geometria de rota insuficiente retornada pelo servidor viário.")
            }
            val distMeters = route.get("distance")?.asDouble
                ?: GeoNavigationEngine.calculatePolylineDistanceMeters(points)
            val durSec = route.get("duration")?.asDouble ?: (distMeters / 8.0)

            DrivingRoute(
                distanceKm = (distMeters / 100.0).roundToInt() / 10.0,
                durationMinutes = max(1, (durSec / 60.0).roundToInt()),
                coords = points,
                summary = "OSRM",
                provider = "osrm"
            )
        }
    }

    suspend fun searchAddresses(
        rawQuery: String,
        api: VaiCarApi = VaiCarApiClient.service
    ): List<PlacePredictionDto> = withContext(Dispatchers.IO) {
        val trimmed = rawQuery.trim()
        if (trimmed.length < 3) return@withContext emptyList()

        val biased = GeoNavigationEngine.buildBiasedAddressQuery(trimmed)
        val results = mutableListOf<PlacePredictionDto>()

        // 1. Existing backend /api/v1/maps/autocomplete
        try {
            val res = api.autocomplete(AutocompleteRequest(input = biased))
            val items = res.data.orEmpty()
                .filter { !isSyntheticPreset(it.placeId) && it.description.isNotBlank() }
                .map { item ->
                    val inArea = if (item.lat != null && item.lng != null) {
                        GeoNavigationEngine.isWithinOperationalArea(item.lat, item.lng)
                    } else {
                        item.inOperationalArea
                    }
                    item.copy(inOperationalArea = inArea)
                }
            results.addAll(items)
        } catch (_: Exception) {
            // Fall through to Nominatim
        }

        if (results.isNotEmpty()) {
            return@withContext results.distinctBy { it.description.lowercase() }.take(6)
        }

        // 2. Fallback: Nominatim bounded strictly to São Sebastião / Litoral Norte
        try {
            val b = GeoNavigationEngine.SAO_SEBASTIAO_BOUNDS
            val encoded = URLEncoder.encode(biased, StandardCharsets.UTF_8.name())
            val url = "${nominatimBaseUrl.trimEnd('/')}/search?format=jsonv2&addressdetails=1" +
                "&limit=6&countrycodes=br&accept-language=pt-BR" +
                "&viewbox=${b.minLng},${b.maxLat},${b.maxLng},${b.minLat}&bounded=1&q=$encoded"

            val request = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("User-Agent", "VaiCarAndroid/2.0 (SaoSebastiao)")
                .build()

            externalClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                val arr = JsonParser.parseString(response.body?.string().orEmpty()).asJsonArray
                for (el in arr) {
                    val obj = el.asJsonObject
                    val lat = obj.get("lat")?.asString?.toDoubleOrNull() ?: continue
                    val lng = obj.get("lon")?.asString?.toDoubleOrNull() ?: continue
                    if (!GeoNavigationEngine.isValidCoordinate(lat, lng)) continue
                    val displayName = obj.get("display_name")?.asString?.trim().orEmpty()
                    if (displayName.isBlank()) continue
                    val parts = displayName.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                    results.add(
                        PlacePredictionDto(
                            description = parts.take(4).joinToString(", "),
                            placeId = "osm-${obj.get("place_id")?.asString ?: "$lat,$lng"}",
                            mainText = parts.firstOrNull() ?: displayName,
                            secondaryText = parts.drop(1).take(2).joinToString(", "),
                            lat = lat,
                            lng = lng,
                            inOperationalArea = GeoNavigationEngine.isWithinOperationalArea(lat, lng)
                        )
                    )
                }
            }
        } catch (_: Exception) {
            // Return empty safely — never invent coordinates
        }

        results.distinctBy { it.description.lowercase() }.take(6)
    }

    suspend fun geocodeAddress(
        address: String,
        api: VaiCarApi = VaiCarApiClient.service
    ): GeocodeResultDto? = withContext(Dispatchers.IO) {
        val biased = GeoNavigationEngine.buildBiasedAddressQuery(address)
        if (biased.isBlank()) return@withContext null

        try {
            val res = api.geocode(GeocodeRequest(address = biased))
            val data = res.data
            if (data != null && GeoNavigationEngine.isValidCoordinate(data.lat, data.lng)) {
                return@withContext data
            }
        } catch (_: Exception) {
            // Try Nominatim fallback
        }

        val matches = searchAddresses(address, api)
        val first = matches.firstOrNull { it.lat != null && it.lng != null } ?: return@withContext null
        GeocodeResultDto(
            address = first.description,
            lat = first.lat!!,
            lng = first.lng!!
        )
    }

    suspend fun reverseGeocode(
        lat: Double,
        lng: Double,
        api: VaiCarApi = VaiCarApiClient.service
    ): String = withContext(Dispatchers.IO) {
        if (!GeoNavigationEngine.isValidCoordinate(lat, lng)) {
            return@withContext ""
        }
        try {
            val res = api.reverseGeocode(ReverseGeocodeRequest(lat = lat, lng = lng))
            val addr = res.data?.address?.trim()
            if (!addr.isNullOrBlank()) return@withContext addr
        } catch (_: Exception) {
            // Fall through to Nominatim reverse
        }

        try {
            val url = "${nominatimBaseUrl.trimEnd('/')}/reverse?format=jsonv2&lat=$lat&lon=$lng&accept-language=pt-BR"
            val request = Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .header("User-Agent", "VaiCarAndroid/2.0 (SaoSebastiao)")
                .build()
            externalClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val obj = JsonParser.parseString(response.body?.string().orEmpty()).asJsonObject
                    val displayName = obj.get("display_name")?.asString?.trim()
                    if (!displayName.isNullOrBlank()) {
                        return@withContext displayName.split(",").take(3).joinToString(", ") { it.trim() }
                    }
                }
            }
        } catch (_: Exception) {
            // Return formatted real coordinates if offline
        }

        "Localização GPS (${"%.5f".format(lat)}, ${"%.5f".format(lng)})"
    }
}
