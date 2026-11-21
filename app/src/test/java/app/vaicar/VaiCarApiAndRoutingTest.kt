package app.vaicar

import app.vaicar.data.LoginRequest
import app.vaicar.data.RouteRepository
import app.vaicar.data.UpdateDriverLocationRequest
import app.vaicar.data.VaiCarApi
import app.vaicar.data.VaiCarApiClient
import app.vaicar.data.VaiCarSession
import app.vaicar.geo.GeoPoint
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class VaiCarApiAndRoutingTest {

    private lateinit var server: MockWebServer
    private lateinit var api: VaiCarApi
    private lateinit var originalOsrmUrl: String
    private lateinit var originalNominatimUrl: String

    @Before
    fun setUp() {
        originalOsrmUrl = RouteRepository.osrmBaseUrl
        originalNominatimUrl = RouteRepository.nominatimBaseUrl
        server = MockWebServer()
        server.start()
        val baseUrl = server.url("/").toString()
        api = VaiCarApiClient.createForBaseUrl(baseUrl)
        RouteRepository.osrmBaseUrl = baseUrl
        RouteRepository.nominatimBaseUrl = baseUrl
        VaiCarSession.clear()
    }

    @After
    fun tearDown() {
        RouteRepository.osrmBaseUrl = originalOsrmUrl
        RouteRepository.nominatimBaseUrl = originalNominatimUrl
        VaiCarSession.clear()
        server.shutdown()
    }

    @Test
    fun loginAndAuthenticatedSyncCarryBearerToken() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """{"success":true,"token":"jwt-test-123","user":{"uid":"u1","email":"driver@vaicar.app","role":"driver"},"roles":["driver"]}"""
            )
        )
        server.enqueue(
            MockResponse().setBody(
                """{"success":true,"hasLiveLocation":true,"status":"DRIVER_ARRIVING","driverLocation":{"lat":-23.8041,"lng":-45.4022,"accuracy":12.0,"updatedAt":"2026-11-21T05:00:00Z"}}"""
            )
        )

        val login = api.login(LoginRequest("driver@vaicar.app", "123456"))
        assertTrue(login.success)
        assertEquals("jwt-test-123", login.token)

        VaiCarSession.token = login.token
        val loc = api.postRideDriverLocation(
            "ride-42",
            UpdateDriverLocationRequest(lat = -23.8041, lng = -45.4022, accuracy = 12.0)
        )
        assertTrue(loc.hasLiveLocation)
        assertEquals(-23.8041, loc.driverLocation!!.lat, 0.0001)

        server.takeRequest() // login
        val secondReq = server.takeRequest()
        assertEquals("Bearer jwt-test-123", secondReq.getHeader("Authorization"))
        assertEquals("/api/v1/rides/ride-42/driver-location", secondReq.path)
    }

    @Test
    fun drivingRouteParsesRawServerDirectionsJson() = runTest {
        // Real backend /api/v1/maps/directions returns raw JSON without {success:true}
        server.enqueue(
            MockResponse().setBody(
                """{"distanceKm":6.4,"durationMin":12,"encodedPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@","summary":"Rod. Dr. Manoel Hyppolito do Rego","fallback":false}"""
            )
        )

        val route = RouteRepository.getDrivingRoute(
            GeoPoint(-23.8055, -45.4011),
            GeoPoint(-23.7905, -45.5608),
            api = api
        )
        assertEquals("server", route.provider)
        assertEquals(6.4, route.distanceKm, 0.01)
        assertEquals(12, route.durationMinutes)
        assertEquals(3, route.coords.size)
    }

    @Test
    fun drivingRouteRejectsServerFallbackAndUsesRealOsrmGeometry() = runTest {
        // 1. Server returns fallback:true with empty polyline
        server.enqueue(
            MockResponse().setBody(
                """{"distanceKm":10.0,"durationMin":15,"encodedPolyline":"","fallback":true}"""
            )
        )
        // 2. OSRM fallback returns real road GeoJSON coordinates
        server.enqueue(
            MockResponse().setBody(
                """{"code":"Ok","routes":[{"distance":5200.0,"duration":600.0,"geometry":{"type":"LineString","coordinates":[[-45.4011,-23.8055],[-45.4100,-23.8020],[-45.4200,-23.7990]]}}]}"""
            )
        )

        val route = RouteRepository.getDrivingRoute(
            GeoPoint(-23.8055, -45.4011),
            GeoPoint(-23.7990, -45.4200),
            api = api
        )
        assertEquals("osrm", route.provider)
        assertEquals(3, route.coords.size)
        assertEquals(5.2, route.distanceKm, 0.05)
        assertEquals(10, route.durationMinutes)
    }

    @Test
    fun drivingRouteNeverFabricatesStraightLineWhenProvidersFail() = runTest {
        server.enqueue(MockResponse().setResponseCode(503))
        server.enqueue(MockResponse().setResponseCode(503))

        try {
            RouteRepository.getDrivingRoute(
                GeoPoint(-23.8055, -45.4011),
                GeoPoint(-23.7905, -45.5608),
                api = api
            )
            fail("Expected failure when both routing providers fail — must NEVER fabricate straight line")
        } catch (expected: Exception) {
            assertTrue(expected.message != null)
        }
    }

    @Test
    fun addressSearchFiltersLegacyPresetsAndMarksOperationalArea() = runTest {
        server.enqueue(
            MockResponse().setBody(
                """{
                  "success": true,
                  "data": [
                    {"description":"Praia Predefinida","placeId":"loc-maresias","lat":-23.79,"lng":-45.56},
                    {"description":"Av. Walkir Vergani, Boiçucanga, São Sebastião","placeId":"ChIJ123","lat":-23.7824,"lng":-45.6275},
                    {"description":"Av. Paulista, São Paulo","placeId":"ChIJ999","lat":-23.5614,"lng":-46.6559}
                  ]
                }"""
            )
        )

        val results = RouteRepository.searchAddresses("Walkir Vergani", api = api)
        assertEquals(2, results.size)
        assertFalse(results.any { it.placeId?.startsWith("loc-") == true })
        assertEquals(true, results[0].inOperationalArea)
        assertEquals(false, results[1].inOperationalArea)
    }
}
