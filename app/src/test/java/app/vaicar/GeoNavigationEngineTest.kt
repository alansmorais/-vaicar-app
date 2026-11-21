package app.vaicar

import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import app.vaicar.geo.GpsSample
import app.vaicar.geo.TransmittedLocation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoNavigationEngineTest {

    @Test
    fun validatesSaoSebastiaoOperationalAreaAndRejectsOutside() {
        // Inside São Sebastião (Centro, Maresias, Boiçucanga, Boracéia, Canto do Mar)
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(-23.8055, -45.4011))
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(-23.7905, -45.5608))
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(-23.7824, -45.6275))
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(-23.7568, -45.8282))
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(-23.7192, -45.4146))

        // Outside São Sebastião (São Paulo capital, Caraguatatuba, Rio, invalid 0,0)
        assertFalse(GeoNavigationEngine.isWithinOperationalArea(-23.5505, -46.6333))
        assertFalse(GeoNavigationEngine.isWithinOperationalArea(-23.6203, -45.4132))
        assertFalse(GeoNavigationEngine.isWithinOperationalArea(-22.9068, -43.1729))
        assertFalse(GeoNavigationEngine.isWithinOperationalArea(0.0, 0.0))

        val outResult = GeoNavigationEngine.validateOperationalPoint(-23.5505, -46.6333, "Destino")
        assertFalse(outResult.valid)
        assertEquals("OUT_OF_AREA", outResult.code)
        assertTrue(outResult.message!!.contains("São Sebastião"))
    }

    @Test
    fun biasesLocalQueriesWithoutOverridingExplicitOtherCities() {
        assertEquals(
            "Av. Walkir Vergani, São Sebastião, SP",
            GeoNavigationEngine.buildBiasedAddressQuery("Av. Walkir Vergani")
        )
        assertEquals(
            "Av. Paulista, São Paulo",
            GeoNavigationEngine.buildBiasedAddressQuery("Av. Paulista, São Paulo")
        )
        assertEquals(
            "Centro, Caraguatatuba",
            GeoNavigationEngine.buildBiasedAddressQuery("Centro, Caraguatatuba")
        )
    }

    @Test
    fun decodesPolylineAndRejectsMalformedStrings() {
        // Standard Google Polyline5 example: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
        val decoded = GeoNavigationEngine.decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
        assertEquals(3, decoded.size)
        assertEquals(38.5, decoded[0].lat, 0.001)
        assertEquals(-120.2, decoded[0].lng, 0.001)
        assertEquals(43.252, decoded[2].lat, 0.001)

        assertTrue(GeoNavigationEngine.decodePolyline("").isEmpty())
        assertTrue(GeoNavigationEngine.decodePolyline(null).isEmpty())
    }

    @Test
    fun detectsOffRouteDeviationAndRespectsCooldownAndAccuracy() {
        val route = listOf(
            GeoPoint(-23.8055, -45.4011),
            GeoPoint(-23.8000, -45.4011),
            GeoPoint(-23.7950, -45.4011)
        )
        val target = route.last()
        val now = 1_700_000_050_000L

        // On route -> should NOT recalculate
        val onRoute = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = GeoPoint(-23.8020, -45.4011),
            currentAccuracyMeters = 10f,
            activePolyline = route,
            lastRouteOrigin = route.first(),
            target = target,
            lastRouteTarget = target,
            lastCalculatedAtMs = now - 15_000L,
            nowMs = now
        )
        assertFalse(onRoute.shouldRecalculate)

        // ~200m east off route after cooldown -> MUST recalculate
        val offRoute = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = GeoPoint(-23.8020, -45.3990),
            currentAccuracyMeters = 12f,
            activePolyline = route,
            lastRouteOrigin = route.first(),
            target = target,
            lastRouteTarget = target,
            lastCalculatedAtMs = now - 12_000L,
            nowMs = now
        )
        assertTrue(offRoute.shouldRecalculate)
        assertEquals("off_route", offRoute.reason)

        // Same deviation inside cooldown (3s ago) -> should NOT spam recalculation
        val inCooldown = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = GeoPoint(-23.8020, -45.3990),
            currentAccuracyMeters = 12f,
            activePolyline = route,
            lastRouteOrigin = route.first(),
            target = target,
            lastRouteTarget = target,
            lastCalculatedAtMs = now - 3_000L,
            nowMs = now
        )
        assertFalse(inCooldown.shouldRecalculate)

        // Very poor GPS accuracy (150m) -> should NOT trigger false off-route
        val poorAccuracy = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = GeoPoint(-23.8020, -45.3990),
            currentAccuracyMeters = 150f,
            activePolyline = route,
            lastRouteOrigin = route.first(),
            target = target,
            lastRouteTarget = target,
            lastCalculatedAtMs = now - 12_000L,
            nowMs = now
        )
        assertFalse(poorAccuracy.shouldRecalculate)
    }

    @Test
    fun trimsPolylineFromDriverPosition() {
        val route = listOf(
            GeoPoint(-23.8055, -45.4011),
            GeoPoint(-23.8000, -45.4011),
            GeoPoint(-23.7950, -45.4011)
        )
        val trimmed = GeoNavigationEngine.trimPolylineFromPosition(GeoPoint(-23.8000, -45.4011), route)
        assertNotNull(trimmed)
        assertTrue(trimmed!!.remainingDistanceMeters < 650.0)
        assertTrue(trimmed.remainingDistanceMeters > 450.0)
        assertEquals(route.last(), trimmed.coords.last())
    }

    @Test
    fun filtersGpsJitterAndTeleportJumps() {
        val t0 = 1_700_000_000_000L
        val first = GpsSample(lat = -23.8055, lng = -45.4011, accuracy = 10f, timestampMs = t0)
        assertTrue(GeoNavigationEngine.filterGpsSample(null, first).accepted)

        // 1m jitter 2s later -> rejected
        val jitter = GpsSample(lat = -23.80551, lng = -45.4011, accuracy = 12f, timestampMs = t0 + 2_000L)
        val jitterRes = GeoNavigationEngine.filterGpsSample(first, jitter)
        assertFalse(jitterRes.accepted)
        assertEquals("micro_jitter", jitterRes.reason)

        // 5km teleport jump in 1s -> rejected
        val teleport = GpsSample(lat = -23.7600, lng = -45.4011, accuracy = 50f, timestampMs = t0 + 1_000L)
        val teleportRes = GeoNavigationEngine.filterGpsSample(first, teleport)
        assertFalse(teleportRes.accepted)
        assertEquals("teleport_jump", teleportRes.reason)

        // Realistic 40m car movement in 4s -> accepted
        val realMove = GpsSample(lat = -23.80514, lng = -45.4011, accuracy = 10f, timestampMs = t0 + 4_000L)
        assertTrue(GeoNavigationEngine.filterGpsSample(first, realMove).accepted)
    }

    @Test
    fun checksGpsFreshnessAndDriverTransmitThrottle() {
        val now = 1_700_000_100_000L
        assertTrue(GeoNavigationEngine.isGpsFresh("2023-11-14T22:14:40Z", nowMs = now))
        assertFalse(GeoNavigationEngine.isGpsFresh("2023-11-14T22:10:00Z", nowMs = now))
        assertFalse(GeoNavigationEngine.isGpsFresh(null, nowMs = now))

        val last = TransmittedLocation(lat = -23.8055, lng = -45.4011, sentAtMs = now - 1_000L)
        // Too soon (1s)
        assertFalse(GeoNavigationEngine.shouldTransmitDriverLocation(last, GeoPoint(-23.8050, -45.4011), nowMs = now))
        // 5s later and moved > 20m -> transmit
        assertTrue(GeoNavigationEngine.shouldTransmitDriverLocation(last, GeoPoint(-23.8052, -45.4011), nowMs = now + 4_000L))
        // 20s later even stationary -> heartbeat transmit
        assertTrue(GeoNavigationEngine.shouldTransmitDriverLocation(last, GeoPoint(-23.8055, -45.4011), nowMs = now + 19_000L))
    }
}
