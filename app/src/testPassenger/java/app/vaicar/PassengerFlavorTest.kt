package app.vaicar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PassengerFlavorTest {
    @Test
    fun passengerFlavorHasRequiredApplicationIdAndUnifiedBackend() {
        assertEquals("com.vaicar.passenger", BuildConfig.APPLICATION_ID)
        assertEquals("passenger", BuildConfig.APP_ROLE)
        assertEquals("VaiCar Passageiro", BuildConfig.APP_DISPLAY_NAME)
        assertTrue(BuildConfig.API_BASE_URL.startsWith("https://vaicar-app-770203144889.southamerica-east1.run.app/"))
    }
}
