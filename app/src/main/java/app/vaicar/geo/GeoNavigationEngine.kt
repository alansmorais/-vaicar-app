package app.vaicar.geo

import java.time.Instant
import java.time.format.DateTimeParseException
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class GeoPoint(val lat: Double, val lng: Double)

data class GpsSample(
    val lat: Double,
    val lng: Double,
    val accuracy: Float? = null,
    val heading: Float? = null,
    val speed: Float? = null,
    val timestampMs: Long,
    val updatedAt: String = Instant.ofEpochMilli(timestampMs).toString()
)

data class OperationalBounds(
    val minLat: Double,
    val maxLat: Double,
    val minLng: Double,
    val maxLng: Double
)

data class OperationalValidationResult(
    val valid: Boolean,
    val code: String? = null,
    val message: String? = null
)

data class PolylineMatch(
    val distanceMeters: Double,
    val segmentIndex: Int,
    val projectedPoint: GeoPoint,
    val remainingDistanceMeters: Double,
    val totalDistanceMeters: Double
)

data class TrimmedPolyline(
    val coords: List<GeoPoint>,
    val remainingDistanceMeters: Double,
    val deviationMeters: Double
)

data class RecalculationDecision(
    val shouldRecalculate: Boolean,
    val reason: String,
    val deviationMeters: Int? = null,
    val thresholdMeters: Int? = null
)

data class GpsFilterResult(
    val accepted: Boolean,
    val sample: GpsSample? = null,
    val reason: String? = null
)

data class TransmittedLocation(
    val lat: Double,
    val lng: Double,
    val sentAtMs: Long
)

/**
 * Shared geographic validation, GPS anti-jump filter, polyline geometry,
 * and automatic off-route recalculation engine for VaiCar Android apps.
 *
 * Mirrors web/src/utils/geoNavigation.ts for 100% behavioral parity across
 * Website, VaiCar Passageiro, and VaiCar Motorista.
 */
object GeoNavigationEngine {

    /** Viewport default ONLY — NEVER used as a fake GPS position. */
    val SAO_SEBASTIAO_CENTER = GeoPoint(lat = -23.8055, lng = -45.4011)

    /** Municipality of São Sebastião operational envelope (Boracéia -> Canto do Mar). */
    val SAO_SEBASTIAO_BOUNDS = OperationalBounds(
        minLat = -23.875,
        maxLat = -23.685,
        minLng = -45.855,
        maxLng = -45.375
    )

    const val GPS_FRESHNESS_MAX_AGE_MS = 60_000L
    const val GPS_FUTURE_SKEW_TOLERANCE_MS = 10_000L
    const val GPS_LOW_ACCURACY_WARNING_METERS = 80f
    const val GPS_MAX_ACCEPTED_ACCURACY_METERS = 500f
    const val GPS_OFF_ROUTE_MAX_ACCURACY_METERS = 100f

    const val MIN_OFF_ROUTE_THRESHOLD_METERS = 45.0
    const val MAX_OFF_ROUTE_THRESHOLD_METERS = 120.0
    const val REROUTE_COOLDOWN_MS = 8_000L
    const val PROGRESS_REFRESH_MIN_DISTANCE_METERS = 250.0
    const val PROGRESS_REFRESH_MIN_INTERVAL_MS = 20_000L

    const val DRIVER_TRANSMIT_MIN_INTERVAL_MS = 3_000L
    const val DRIVER_TRANSMIT_MIN_DISTANCE_METERS = 10.0
    const val DRIVER_TRANSMIT_HEARTBEAT_MS = 18_000L

    private const val EARTH_RADIUS_METERS = 6_371_000.0

    private val EXPLICIT_CITY_OR_STATE_REGEX = Regex(
        """\b(s[aã]o\s+sebasti[aã]o|ilhabela|caraguatatuba|ubatuba|bertioga|santos|guaruj[aá]|s[aã]o\s+paulo|campinas|s[aã]o\s+jos[eé]\s+dos\s+campos|taubat[eé]|rio\s+de\s+janeiro|curitiba|belo\s+horizonte|minas\s+gerais|paraty|rj|mg|pr|sc|rs|ba|df|go|ce|pe|es)\b""",
        RegexOption.IGNORE_CASE
    )

    fun isValidCoordinate(lat: Double?, lng: Double?): Boolean {
        if (lat == null || lng == null) return false
        if (!lat.isFinite() || !lng.isFinite()) return false
        if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) return false
        if (abs(lat) < 1e-7 && abs(lng) < 1e-7) return false
        return true
    }

    fun isWithinOperationalArea(
        lat: Double,
        lng: Double,
        bounds: OperationalBounds = SAO_SEBASTIAO_BOUNDS
    ): Boolean {
        if (!isValidCoordinate(lat, lng)) return false
        return lat in bounds.minLat..bounds.maxLat && lng in bounds.minLng..bounds.maxLng
    }

    fun validateOperationalPoint(
        lat: Double,
        lng: Double,
        pointLabel: String = "Este endereço"
    ): OperationalValidationResult {
        if (!isValidCoordinate(lat, lng)) {
            return OperationalValidationResult(
                valid = false,
                code = "INVALID_COORDS",
                message = "$pointLabel possui coordenadas inválidas. Selecione uma sugestão válida ou toque no mapa."
            )
        }
        if (!isWithinOperationalArea(lat, lng)) {
            return OperationalValidationResult(
                valid = false,
                code = "OUT_OF_AREA",
                message = "$pointLabel está fora da área operacional do VaiCar (São Sebastião — Costa Sul, Centro e Costa Norte)."
            )
        }
        return OperationalValidationResult(valid = true)
    }

    fun buildBiasedAddressQuery(rawQuery: String): String {
        val trimmed = rawQuery.trim()
        if (trimmed.isEmpty()) return ""
        return if (EXPLICIT_CITY_OR_STATE_REGEX.containsMatchIn(trimmed)) {
            trimmed
        } else {
            "$trimmed, São Sebastião, SP"
        }
    }

    fun haversineDistanceMeters(a: GeoPoint, b: GeoPoint): Double {
        val dLat = Math.toRadians(b.lat - a.lat)
        val dLng = Math.toRadians(b.lng - a.lng)
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)

        val sinDLat = sin(dLat / 2.0)
        val sinDLng = sin(dLng / 2.0)
        val h = sinDLat * sinDLat + cos(lat1) * cos(lat2) * sinDLng * sinDLng
        return 2.0 * EARTH_RADIUS_METERS * atan2(sqrt(h), sqrt(max(0.0, 1.0 - h)))
    }

    fun decodePolyline(encoded: String?): List<GeoPoint> {
        if (encoded.isNullOrBlank()) return emptyList()
        val points = mutableListOf<GeoPoint>()
        var index = 0
        val len = encoded.length
        var lat = 0
        var lng = 0

        while (index < len) {
            var b: Int
            var shift = 0
            var result = 0
            do {
                if (index >= len) return emptyList()
                b = encoded[index++].code - 63
                if (b < 0) return emptyList()
                result = result or ((b and 0x1f) shl shift)
                shift += 5
                if (shift > 35) return emptyList()
            } while (b >= 0x20)
            val dlat = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lat += dlat

            shift = 0
            result = 0
            do {
                if (index >= len) return emptyList()
                b = encoded[index++].code - 63
                if (b < 0) return emptyList()
                result = result or ((b and 0x1f) shl shift)
                shift += 5
                if (shift > 35) return emptyList()
            } while (b >= 0x20)
            val dlng = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lng += dlng

            val decodedLat = lat / 1e5
            val decodedLng = lng / 1e5
            if (!isValidCoordinate(decodedLat, decodedLng)) return emptyList()
            points.add(GeoPoint(decodedLat, decodedLng))
        }
        return points
    }

    fun calculatePolylineDistanceMeters(coords: List<GeoPoint>): Double {
        if (coords.size < 2) return 0.0
        var total = 0.0
        for (i in 1 until coords.size) {
            total += haversineDistanceMeters(coords[i - 1], coords[i])
        }
        return total
    }

    fun distancePointToSegmentMeters(
        point: GeoPoint,
        segStart: GeoPoint,
        segEnd: GeoPoint
    ): Pair<Double, GeoPoint> {
        val refLatRad = Math.toRadians(point.lat)
        val metersPerDegLat = 111_132.92
        val metersPerDegLng = 111_412.84 * cos(refLatRad)

        val ax = (segStart.lng - point.lng) * metersPerDegLng
        val ay = (segStart.lat - point.lat) * metersPerDegLat
        val bx = (segEnd.lng - point.lng) * metersPerDegLng
        val by = (segEnd.lat - point.lat) * metersPerDegLat

        val dx = bx - ax
        val dy = by - ay
        val lenSq = dx * dx + dy * dy

        val t = if (lenSq > 1e-9) {
            max(0.0, min(1.0, -(ax * dx + ay * dy) / lenSq))
        } else {
            0.0
        }

        val px = ax + t * dx
        val py = ay + t * dy
        val dist = hypot(px, py)
        val projected = GeoPoint(
            lat = segStart.lat + t * (segEnd.lat - segStart.lat),
            lng = segStart.lng + t * (segEnd.lng - segStart.lng)
        )
        return dist to projected
    }

    fun findNearestPointOnPolyline(point: GeoPoint, polyline: List<GeoPoint>): PolylineMatch? {
        if (polyline.size < 2 || !isValidCoordinate(point.lat, point.lng)) return null

        var bestDist = Double.POSITIVE_INFINITY
        var bestIdx = 0
        var bestProj = polyline.first()

        val segLengths = DoubleArray(polyline.size - 1)
        var totalMeters = 0.0

        for (i in 0 until polyline.size - 1) {
            val start = polyline[i]
            val end = polyline[i + 1]
            val segLen = haversineDistanceMeters(start, end)
            segLengths[i] = segLen
            totalMeters += segLen

            val (dist, proj) = distancePointToSegmentMeters(point, start, end)
            if (dist < bestDist) {
                bestDist = dist
                bestIdx = i
                bestProj = proj
            }
        }

        var remaining = haversineDistanceMeters(bestProj, polyline[bestIdx + 1])
        for (i in (bestIdx + 1) until segLengths.size) {
            remaining += segLengths[i]
        }

        return PolylineMatch(
            distanceMeters = bestDist,
            segmentIndex = bestIdx,
            projectedPoint = bestProj,
            remainingDistanceMeters = remaining,
            totalDistanceMeters = totalMeters
        )
    }

    fun trimPolylineFromPosition(point: GeoPoint, polyline: List<GeoPoint>): TrimmedPolyline? {
        val nearest = findNearestPointOnPolyline(point, polyline) ?: return null
        val tail = polyline.subList(nearest.segmentIndex + 1, polyline.size)
        val trimmed = listOf(nearest.projectedPoint) + tail
        return TrimmedPolyline(
            coords = if (trimmed.size >= 2) trimmed else polyline,
            remainingDistanceMeters = nearest.remainingDistanceMeters,
            deviationMeters = nearest.distanceMeters
        )
    }

    fun shouldRecalculateRoute(
        currentPos: GeoPoint,
        currentAccuracyMeters: Float?,
        activePolyline: List<GeoPoint>?,
        lastRouteOrigin: GeoPoint?,
        target: GeoPoint,
        lastRouteTarget: GeoPoint?,
        lastCalculatedAtMs: Long,
        nowMs: Long = System.currentTimeMillis()
    ): RecalculationDecision {
        if (activePolyline.isNullOrEmpty() || activePolyline.size < 2 || lastRouteOrigin == null || lastRouteTarget == null) {
            return RecalculationDecision(true, "initial")
        }

        if (haversineDistanceMeters(target, lastRouteTarget) > 10.0) {
            return RecalculationDecision(true, "destination_changed")
        }

        val nearest = findNearestPointOnPolyline(currentPos, activePolyline)
            ?: return RecalculationDecision(true, "initial")

        val accuracy = if (currentAccuracyMeters != null && currentAccuracyMeters.isFinite() && currentAccuracyMeters > 0f) {
            currentAccuracyMeters.toDouble()
        } else {
            15.0
        }

        val threshold = max(
            MIN_OFF_ROUTE_THRESHOLD_METERS,
            min(MAX_OFF_ROUTE_THRESHOLD_METERS, 35.0 + min(accuracy, 65.0))
        )
        val elapsedMs = nowMs - lastCalculatedAtMs

        if (accuracy <= GPS_OFF_ROUTE_MAX_ACCURACY_METERS && nearest.distanceMeters > threshold) {
            if (elapsedMs >= REROUTE_COOLDOWN_MS) {
                return RecalculationDecision(
                    shouldRecalculate = true,
                    reason = "off_route",
                    deviationMeters = nearest.distanceMeters.roundToInt(),
                    thresholdMeters = threshold.roundToInt()
                )
            }
        }

        val moved = haversineDistanceMeters(currentPos, lastRouteOrigin)
        if (moved >= PROGRESS_REFRESH_MIN_DISTANCE_METERS && elapsedMs >= PROGRESS_REFRESH_MIN_INTERVAL_MS) {
            return RecalculationDecision(
                shouldRecalculate = true,
                reason = "periodic_progress_refresh",
                deviationMeters = nearest.distanceMeters.roundToInt(),
                thresholdMeters = threshold.roundToInt()
            )
        }

        return RecalculationDecision(
            shouldRecalculate = false,
            reason = "none",
            deviationMeters = nearest.distanceMeters.roundToInt(),
            thresholdMeters = threshold.roundToInt()
        )
    }

    fun isGpsFresh(
        updatedAtIso: String?,
        nowMs: Long = System.currentTimeMillis(),
        maxAgeMs: Long = GPS_FRESHNESS_MAX_AGE_MS
    ): Boolean {
        if (updatedAtIso.isNullOrBlank()) return false
        return try {
            val parsedMs = Instant.parse(updatedAtIso).toEpochMilli()
            val age = nowMs - parsedMs
            age >= -GPS_FUTURE_SKEW_TOLERANCE_MS && age <= maxAgeMs
        } catch (_: DateTimeParseException) {
            false
        }
    }

    fun filterGpsSample(previous: GpsSample?, incoming: GpsSample): GpsFilterResult {
        if (!isValidCoordinate(incoming.lat, incoming.lng)) {
            return GpsFilterResult(false, reason = "invalid_coords")
        }

        val incAcc = incoming.accuracy?.takeIf { it.isFinite() && it >= 0f }

        if (previous == null) {
            if (incAcc != null && incAcc > 2000f) {
                return GpsFilterResult(false, reason = "poor_accuracy")
            }
            return GpsFilterResult(true, sample = incoming)
        }

        if (incoming.timestampMs < previous.timestampMs) {
            return GpsFilterResult(false, reason = "stale_timestamp")
        }

        val prevAcc = previous.accuracy?.takeIf { it.isFinite() && it >= 0f } ?: 30f

        if (
            incAcc != null &&
            incAcc > GPS_MAX_ACCEPTED_ACCURACY_METERS &&
            prevAcc <= 100f &&
            (incoming.timestampMs - previous.timestampMs) < 30_000L
        ) {
            return GpsFilterResult(false, reason = "poor_accuracy")
        }

        val distMeters = haversineDistanceMeters(
            GeoPoint(previous.lat, previous.lng),
            GeoPoint(incoming.lat, incoming.lng)
        )
        val dtSec = max(0.1, (incoming.timestampMs - previous.timestampMs) / 1000.0)
        val impliedSpeedMps = distMeters / dtSec

        if (
            (impliedSpeedMps > 55.0 && (incAcc == null || incAcc > 35f)) ||
            (dtSec < 2.0 && distMeters > 300.0)
        ) {
            return GpsFilterResult(false, reason = "teleport_jump")
        }

        val jitterFloor = max(4.0, min(12.0, (incAcc ?: 15f) * 0.35))
        val accuracyImprovedMuch = incAcc != null && (prevAcc - incAcc) >= 20f

        if (distMeters < jitterFloor && !accuracyImprovedMuch) {
            if (incoming.timestampMs - previous.timestampMs >= 15_000L) {
                return GpsFilterResult(
                    accepted = true,
                    sample = previous.copy(
                        accuracy = incAcc ?: previous.accuracy,
                        timestampMs = incoming.timestampMs,
                        updatedAt = incoming.updatedAt
                    )
                )
            }
            return GpsFilterResult(false, reason = "micro_jitter")
        }

        return GpsFilterResult(true, sample = incoming)
    }

    fun shouldTransmitDriverLocation(
        lastSent: TransmittedLocation?,
        current: GeoPoint,
        nowMs: Long = System.currentTimeMillis()
    ): Boolean {
        if (!isValidCoordinate(current.lat, current.lng)) return false
        if (lastSent == null) return true

        val elapsed = nowMs - lastSent.sentAtMs
        if (elapsed >= DRIVER_TRANSMIT_HEARTBEAT_MS) return true
        if (elapsed < DRIVER_TRANSMIT_MIN_INTERVAL_MS) return false

        return haversineDistanceMeters(GeoPoint(lastSent.lat, lastSent.lng), current) >= DRIVER_TRANSMIT_MIN_DISTANCE_METERS
    }

    fun formatTelemetryAge(updatedAtIso: String?, nowMs: Long = System.currentTimeMillis()): String {
        if (updatedAtIso.isNullOrBlank()) return "sem atualização"
        return try {
            val parsedMs = Instant.parse(updatedAtIso).toEpochMilli()
            val sec = max(0L, (nowMs - parsedMs) / 1000L)
            when {
                sec < 10L -> "agora mesmo"
                sec < 60L -> "há ${sec}s"
                else -> "há ${sec / 60L} min"
            }
        } catch (_: DateTimeParseException) {
            "sem atualização"
        }
    }
}
