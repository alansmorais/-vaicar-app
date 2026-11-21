package app.vaicar.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * VaiCar Tropical Premium Design System (matching vaicar.app / vaicar-next web).
 * Base: White (#FFFFFF / #F6FAF7)
 * Primary: Emerald (#07966F)
 * Secondary / Headings: Forest (#174B3B)
 * Body / Ink: Graphite (#263238)
 */
object VaiCarColors {
    val White = Color(0xFFFFFFFF)
    val Background = Color(0xFFF6FAF7)
    val SurfaceVariant = Color(0xFFEDF5F0)
    val Border = Color(0xFFDCE8E0)

    val Emerald = Color(0xFF07966F)
    val EmeraldDark = Color(0xFF087653)
    val EmeraldSoft = Color(0xFFE6F7F1)
    val Forest = Color(0xFF174B3B)
    val ForestDeep = Color(0xFF0E3429)
    val Mint = Color(0xFFA7F3D0)

    val Graphite = Color(0xFF263238)
    val Muted = Color(0xFF64746F)

    val RouteCyan = Color(0xFF0284C7)
    val RouteCyanSoft = Color(0xFFE0F2FE)
    val Rose = Color(0xFFDC2626)
    val RoseSoft = Color(0xFFFEF2F2)
    val Amber = Color(0xFFD97706)
    val AmberSoft = Color(0xFFFFFBEB)
}

private val TropicalPremiumLightScheme = lightColorScheme(
    primary = VaiCarColors.Emerald,
    onPrimary = VaiCarColors.White,
    primaryContainer = VaiCarColors.EmeraldSoft,
    onPrimaryContainer = VaiCarColors.Forest,
    secondary = VaiCarColors.Forest,
    onSecondary = VaiCarColors.White,
    secondaryContainer = VaiCarColors.SurfaceVariant,
    onSecondaryContainer = VaiCarColors.Forest,
    tertiary = VaiCarColors.RouteCyan,
    onTertiary = VaiCarColors.White,
    background = VaiCarColors.Background,
    onBackground = VaiCarColors.Graphite,
    surface = VaiCarColors.White,
    onSurface = VaiCarColors.Graphite,
    surfaceVariant = VaiCarColors.SurfaceVariant,
    onSurfaceVariant = VaiCarColors.Muted,
    outline = VaiCarColors.Border,
    error = VaiCarColors.Rose,
    onError = VaiCarColors.White,
    errorContainer = VaiCarColors.RoseSoft,
    onErrorContainer = VaiCarColors.Rose
)

@Composable
fun VaiCarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TropicalPremiumLightScheme,
        content = content
    )
}
