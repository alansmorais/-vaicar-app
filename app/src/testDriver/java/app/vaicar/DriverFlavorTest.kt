package app.vaicar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DriverFlavorTest {
    @Test
    fun driverFlavorHasRequiredApplicationIdAndUnifiedBackend() {
        assertEquals("com.vaicar.driver", BuildConfig.APPLICATION_ID)
        assertEquals("driver", BuildConfig.APP_ROLE)
        assertEquals("VaiCar Motorista", BuildConfig.APP_DISPLAY_NAME)
        assertTrue(BuildConfig.API_BASE_URL.startsWith("https://vaicar-app-770203144889.southamerica-east1.run.app/"))
    }
}
