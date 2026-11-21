package app.vaicar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import app.vaicar.data.VaiCarSession
import app.vaicar.flavor.RoleAppHost
import app.vaicar.ui.theme.VaiCarTheme
import app.vaicar.util.NotificationHelper
import org.osmdroid.config.Configuration
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configure osmdroid user agent & tile cache (required by OpenStreetMap tile policy)
        val osmConfig = Configuration.getInstance()
        osmConfig.userAgentValue = "${BuildConfig.APPLICATION_ID}/${BuildConfig.VERSION_NAME}"
        val basePath = File(cacheDir, "osmdroid")
        osmConfig.osmdroidBasePath = basePath
        osmConfig.osmdroidTileCache = File(basePath, "tiles")

        // Restore persisted auth session and ensure notification channel
        VaiCarSession.restore(applicationContext)
        NotificationHelper.ensureChannel(applicationContext)

        setContent {
            VaiCarTheme {
                RoleAppHost()
            }
        }
    }
}
