package app.vaicar

import app.vaicar.data.CompleteRideRequest
import app.vaicar.data.LocationPointDto
import app.vaicar.data.RateRideRequest
import app.vaicar.data.RequestRidePayload
import app.vaicar.data.RouteRepository
import app.vaicar.data.UpdateDriverLocationRequest
import app.vaicar.data.VaiCarApi
import app.vaicar.data.VaiCarApiClient
import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * End-to-end 13-step automated contract test verifying synchronized state transitions
 * between VaiCar Passageiro (com.vaicar.passenger) and VaiCar Motorista (com.vaicar.driver)
 * over the shared backend API contract, including live GPS sync and automatic off-route rerouting.
 */
class TwoAppRideIntegrationTest {

    private lateinit var server: MockWebServer
    private lateinit var passengerApi: VaiCarApi
    private lateinit var driverApi: VaiCarApi
    private lateinit var originalOsrmUrl: String

    // Stateful in-memory ride mirror exercising exact API contract
    private var rideStatus = "REQUESTED"
    private var driverLat = -23.8065
    private var driverLng = -45.4025
    private var paymentApproved = false
    private var passengerRating: Int? = null
    private var driverRating: Int? = null
    private var directionsCalls = 0

    private val pickup = LocationPointDto("Centro Histórico, São Sebastião", -23.8055, -45.4011)
    private val destination = LocationPointDto("Praia de Maresias, São Sebastião", -23.7905, -45.5608)

    private fun rideJson(): String = """
        {
          "id": "ride-e2e-01",
          "passengerId": "pax-1",
          "passengerName": "Maria Passageira",
          "passengerPhone": "+5512999990001",
          "driverId": ${if (rideStatus == "REQUESTED") "null" else "\"drv-1\""},
          "driverName": ${if (rideStatus == "REQUESTED") "null" else "\"Carlos Motorista\""},
          "origin": {"address":"${pickup.address}","lat":${pickup.lat},"lng":${pickup.lng}},
          "destination": {"address":"${destination.address}","lat":${destination.lat},"lng":${destination.lng}},
          "distanceKm": 18.4,
          "durationMinutes": 26,
          "fareAmount": 54.9,
          "paymentMethod": "PIX",
          "paymentStatus": "${if (paymentApproved) "PAID" else "PENDING"}",
          "paymentApprovedByDriver": $paymentApproved,
          "status": "$rideStatus",
          "arrivedAt": "2026-11-21T09:05:00Z",
          "waitingTimerStartedAt": "2026-11-21T09:05:00Z",
          "ratingByPassenger": ${passengerRating ?: "null"},
          "ratingByDriver": ${driverRating ?: "null"},
          "driverLocation": {"lat":$driverLat,"lng":$driverLng,"accuracy":10.0,"updatedAt":"2026-11-21T09:06:00Z"}
        }
    """.trimIndent()

    @Before
    fun setUp() {
        originalOsrmUrl = RouteRepository.osrmBaseUrl
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path == "/api/v1/rides/request" && request.method == "POST" -> {
                        rideStatus = "REQUESTED"
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/drivers/offers/pending" && request.method == "GET" -> {
                        MockResponse().setBody(
                            """{"success":true,"data":{"id":"offer-01","rideId":"ride-e2e-01","driverId":"drv-1","status":"PENDING","expiresAt":"2026-11-21T09:06:00Z","secondsRemaining":20,"distanceKm":18.4,"fareAmount":54.9,"origin":{"address":"${pickup.address}","lat":${pickup.lat},"lng":${pickup.lng}},"destination":{"address":"${destination.address}","lat":${destination.lat},"lng":${destination.lng}},"passengerName":"Maria Passageira","passengerPhone":"+5512999990001"}}"""
                        )
                    }
                    path == "/api/v1/drivers/offers/offer-01/accept" && request.method == "POST" -> {
                        rideStatus = "DRIVER_ARRIVING"
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01" && request.method == "GET" -> {
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/driver-location" && request.method == "POST" -> {
                        val body = request.body.readUtf8()
                        Regex(""""lat":([-\d.]+)""").find(body)?.groupValues?.get(1)?.toDoubleOrNull()?.let { driverLat = it }
                        Regex(""""lng":([-\d.]+)""").find(body)?.groupValues?.get(1)?.toDoubleOrNull()?.let { driverLng = it }
                        MockResponse().setBody(
                            """{"success":true,"hasLiveLocation":true,"status":"$rideStatus","driverLocation":{"lat":$driverLat,"lng":$driverLng,"accuracy":10.0,"updatedAt":"2026-11-21T09:06:00Z"}}"""
                        )
                    }
                    path == "/api/v1/rides/ride-e2e-01/driver-location" && request.method == "GET" -> {
                        MockResponse().setBody(
                            """{"success":true,"hasLiveLocation":true,"status":"$rideStatus","driverLocation":{"lat":$driverLat,"lng":$driverLng,"accuracy":10.0,"updatedAt":"2026-11-21T09:06:00Z"}}"""
                        )
                    }
                    path == "/api/v1/rides/ride-e2e-01/arrived" && request.method == "POST" -> {
                        rideStatus = "ARRIVED"
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/start" && request.method == "POST" -> {
                        rideStatus = "IN_PROGRESS"
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/complete" && request.method == "POST" -> {
                        rideStatus = "COMPLETED"
                        MockResponse().setBody("""{"success":true,"data":{"ride":${rideJson()}}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/approve-payment" && request.method == "POST" -> {
                        paymentApproved = true
                        MockResponse().setBody("""{"success":true,"data":{"ride":${rideJson()}}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/rate" && request.method == "POST" -> {
                        passengerRating = 5
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path == "/api/v1/rides/ride-e2e-01/rate-passenger" && request.method == "POST" -> {
                        driverRating = 5
                        MockResponse().setBody("""{"success":true,"data":${rideJson()}}""")
                    }
                    path.startsWith("/api/v1/maps/directions") -> {
                        directionsCalls += 1
                        MockResponse().setBody(
                            """{"distanceKm":18.4,"durationMin":26,"encodedPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@","summary":"SP-055","fallback":false}"""
                        )
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()
        val baseUrl = server.url("/").toString()
        RouteRepository.osrmBaseUrl = baseUrl

        val paxClient = OkHttpClient.Builder().addInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("Authorization", "Bearer pax-token").build())
        }.build()
        val drvClient = OkHttpClient.Builder().addInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("Authorization", "Bearer drv-token").build())
        }.build()

        passengerApi = VaiCarApiClient.createForBaseUrl(baseUrl, paxClient)
        driverApi = VaiCarApiClient.createForBaseUrl(baseUrl, drvClient)
    }

    @After
    fun tearDown() {
        RouteRepository.osrmBaseUrl = originalOsrmUrl
        server.shutdown()
    }

    @Test
    fun executesAll13SynchronizedStepsBetweenPassengerAndDriverApps() = runTest {
        // 1. Passenger requests a ride inside São Sebastião operational area
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(pickup.lat, pickup.lng))
        assertTrue(GeoNavigationEngine.isWithinOperationalArea(destination.lat, destination.lng))
        val requested = passengerApi.requestRide(RequestRidePayload(origin = pickup, destination = destination, paymentMethod = "PIX")).data
        assertNotNull(requested)
        assertEquals("REQUESTED", requested!!.status)

        // 2. Driver polls and receives incoming offer
        val offer = driverApi.pendingOffer().data
        assertNotNull(offer)
        assertEquals("ride-e2e-01", offer!!.rideId)

        // 3. Driver accepts offer
        val accepted = driverApi.acceptOffer(offer.id).data!!
        assertEquals("DRIVER_ARRIVING", accepted.status)

        // 4. Passenger receives live status update
        val paxAfterAccept = passengerApi.getRide(accepted.id).data!!
        assertEquals("DRIVER_ARRIVING", paxAfterAccept.status)
        assertEquals("Carlos Motorista", paxAfterAccept.driverName)

        // 5 & 6. Driver transmits live GPS and calculates real road route to pickup; Passenger tracks it
        driverApi.postRideDriverLocation(accepted.id, UpdateDriverLocationRequest(-23.8060, -45.4018, accuracy = 8.0))
        val paxLiveLoc = passengerApi.getRideDriverLocation(accepted.id)
        assertTrue(paxLiveLoc.hasLiveLocation)
        assertEquals(-23.8060, paxLiveLoc.driverLocation!!.lat, 0.0001)

        val routeToPickup = RouteRepository.getDrivingRoute(
            GeoPoint(paxLiveLoc.driverLocation!!.lat, paxLiveLoc.driverLocation!!.lng),
            GeoPoint(pickup.lat, pickup.lng),
            api = driverApi
        )
        assertTrue(routeToPickup.coords.size >= 2)

        // Driver marks arrival & starts trip (7 & 8)
        val arrived = driverApi.markArrived(accepted.id).data!!
        assertEquals("ARRIVED", arrived.status)
        val started = driverApi.startRide(accepted.id).data!!
        assertEquals("IN_PROGRESS", started.status)
        assertEquals("IN_PROGRESS", passengerApi.getRide(accepted.id).data!!.status)

        // 9 & 10. Driver navigates to confirmed destination & updates real GPS
        val activeRoute = listOf(
            GeoPoint(-23.8055, -45.4011),
            GeoPoint(-23.8000, -45.4500),
            GeoPoint(destination.lat, destination.lng)
        )
        val destGeo = GeoPoint(destination.lat, destination.lng)
        driverApi.postRideDriverLocation(accepted.id, UpdateDriverLocationRequest(-23.8000, -45.4500, accuracy = 10.0))
        val onRouteCheck = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = GeoPoint(-23.8000, -45.4500),
            currentAccuracyMeters = 10f,
            activePolyline = activeRoute,
            lastRouteOrigin = activeRoute.first(),
            target = destGeo,
            lastRouteTarget = destGeo,
            lastCalculatedAtMs = 1_700_000_000_000L,
            nowMs = 1_700_000_012_000L
        )
        assertFalse(onRouteCheck.shouldRecalculate)

        // 11. Driver deviates ~350m off route -> automatic recalculation preserving original destination
        val deviatedPos = GeoPoint(-23.7968, -45.4500)
        val offRouteCheck = GeoNavigationEngine.shouldRecalculateRoute(
            currentPos = deviatedPos,
            currentAccuracyMeters = 10f,
            activePolyline = activeRoute,
            lastRouteOrigin = activeRoute.first(),
            target = destGeo,
            lastRouteTarget = destGeo,
            lastCalculatedAtMs = 1_700_000_000_000L,
            nowMs = 1_700_000_012_000L
        )
        assertTrue(offRouteCheck.shouldRecalculate)
        assertEquals("off_route", offRouteCheck.reason)
        val rerouted = RouteRepository.getDrivingRoute(deviatedPos, destGeo, api = driverApi)
        assertTrue(rerouted.coords.size >= 2)
        assertEquals(2, directionsCalls)

        // 12 & 13. Driver completes ride + approves payment; Passenger receives completion & both rate
        val completed = driverApi.completeRide(accepted.id, CompleteRideRequest(paymentApproved = false)).data!!.ride!!
        assertEquals("COMPLETED", completed.status)
        val paid = driverApi.approvePayment(accepted.id).data!!.ride!!
        assertEquals(true, paid.paymentApprovedByDriver)

        val paxFinal = passengerApi.getRide(accepted.id).data!!
        assertEquals("COMPLETED", paxFinal.status)
        assertEquals("PAID", paxFinal.paymentStatus)

        val ratedByPax = passengerApi.rateDriver(accepted.id, RateRideRequest(5)).data!!
        assertEquals(5, ratedByPax.ratingByPassenger)
        val ratedByDrv = driverApi.ratePassenger(accepted.id, RateRideRequest(5)).data!!
        assertEquals(5, ratedByDrv.ratingByDriver)
    }
}
