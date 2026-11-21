package app.vaicar.ui.components

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import app.vaicar.data.DrivingRoute
import app.vaicar.data.PublicDriverMarkerDto
import app.vaicar.data.RouteRepository
import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import app.vaicar.ui.theme.VaiCarColors
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import kotlin.math.max
import kotlin.math.roundToInt
import org.osmdroid.util.GeoPoint as OsmGeoPoint

enum class MapNavMode {
    PLANNING,
    DRIVER_TO_PICKUP,
    DRIVER_TO_DESTINATION
}

data class MapRouteSummary(
    val distanceKm: Double,
    val durationMinutes: Int,
    val isRerouting: Boolean = false,
    val provider: String = "server"
)

private fun createPinDrawable(
    context: Context,
    fillColor: Int,
    label: String,
    sizeDp: Int = 34
): BitmapDrawable {
    val density = context.resources.displayMetrics.density
    val sizePx = (sizeDp * density).roundToInt().coerceAtLeast(32)
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val cx = sizePx / 2f
    val cy = sizePx / 2f
    val radius = sizePx * 0.42f

    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.FILL
    }
    canvas.drawCircle(cx, cy, radius + (2.5f * density), borderPaint)

    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = fillColor
        style = Paint.Style.FILL
    }
    canvas.drawCircle(cx, cy, radius, fillPaint)

    if (label.isNotEmpty()) {
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textAlign = Paint.Align.CENTER
            textSize = sizePx * 0.42f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val textY = cy - (textPaint.descent() + textPaint.ascent()) / 2f
        canvas.drawText(label, cx, textY, textPaint)
    }

    return BitmapDrawable(context.resources, bmp)
}

fun openExternalNavigation(context: Context, destLat: Double, destLng: Double, useWaze: Boolean = false) {
    val uri = if (useWaze) {
        Uri.parse("https://waze.com/ul?ll=$destLat,$destLng&navigate=yes")
    } else {
        Uri.parse("google.navigation:q=$destLat,$destLng&mode=d")
    }
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try {
        context.startActivity(intent)
    } catch (_: Exception) {
        val fallback = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$destLat,$destLng&travelmode=driving")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        runCatching { context.startActivity(fallback) }
    }
}

@Composable
fun VaiCarOsmMap(
    modifier: Modifier = Modifier,
    mode: MapNavMode = MapNavMode.PLANNING,
    pickup: GeoPoint? = null,
    pickupLabel: String = "Embarque",
    destination: GeoPoint? = null,
    destinationLabel: String = "Destino",
    userLocation: GeoPoint? = null,
    driverLocation: GeoPoint? = null,
    driverAccuracyMeters: Float? = null,
    driverStaleWarning: Boolean = false,
    onlineDrivers: List<PublicDriverMarkerDto> = emptyList(),
    showExternalNavButtons: Boolean = false,
    onMapTap: ((GeoPoint) -> Unit)? = null,
    onRouteUpdated: ((MapRouteSummary?) -> Unit)? = null
) {
    val context = LocalContext.current

    val activeOrigin: GeoPoint? = when (mode) {
        MapNavMode.PLANNING -> pickup
        MapNavMode.DRIVER_TO_PICKUP -> driverLocation
        MapNavMode.DRIVER_TO_DESTINATION -> driverLocation
    }
    val activeTarget: GeoPoint? = when (mode) {
        MapNavMode.PLANNING -> destination
        MapNavMode.DRIVER_TO_PICKUP -> pickup
        MapNavMode.DRIVER_TO_DESTINATION -> destination
    }

    var baseRoute by remember { mutableStateOf<DrivingRoute?>(null) }
    var displayedCoords by remember { mutableStateOf<List<GeoPoint>>(emptyList()) }
    var displayedDistanceKm by remember { mutableStateOf<Double?>(null) }
    var displayedDurationMin by remember { mutableStateOf<Int?>(null) }
    var routeLoading by remember { mutableStateOf(false) }
    var routeError by remember { mutableStateOf<String?>(null) }
    var rerouteCount by remember { mutableIntStateOf(0) }
    var manualRetryNonce by remember { mutableIntStateOf(0) }

    var lastRouteOrigin by remember { mutableStateOf<GeoPoint?>(null) }
    var lastRouteTarget by remember { mutableStateOf<GeoPoint?>(null) }
    var lastCalculatedAtMs by remember { mutableLongStateOf(0L) }
    var mapViewRef by remember { mutableStateOf<MapView?>(null) }
    var hasAutoCentered by remember { mutableStateOf(false) }

    val pickupDrawable = remember(context) {
        createPinDrawable(context, VaiCarColors.Emerald.toArgb(), "A", 34)
    }
    val destinationDrawable = remember(context) {
        createPinDrawable(context, VaiCarColors.Forest.toArgb(), "B", 34)
    }
    val driverDrawable = remember(context) {
        createPinDrawable(context, VaiCarColors.RouteCyan.toArgb(), "V", 36)
    }
    val userDrawable = remember(context) {
        createPinDrawable(context, 0xFF2563EB.toInt(), "•", 24)
    }
    val onlineDriverDrawable = remember(context) {
        createPinDrawable(context, VaiCarColors.EmeraldDark.toArgb(), "V", 24)
    }

    // Clear route when endpoints disappear
    LaunchedEffect(mode, activeOrigin, activeTarget) {
        if (activeOrigin == null || activeTarget == null) {
            baseRoute = null
            displayedCoords = emptyList()
            displayedDistanceKm = null
            displayedDurationMin = null
            routeError = null
            lastRouteOrigin = null
            lastRouteTarget = null
            lastCalculatedAtMs = 0L
            onRouteUpdated?.invoke(null)
        }
    }

    // Real road route calculation + automatic off-route recalculation + on-route polyline trimming
    LaunchedEffect(mode, activeOrigin, activeTarget, driverAccuracyMeters, manualRetryNonce) {
        val origin = activeOrigin ?: return@LaunchedEffect
        val target = activeTarget ?: return@LaunchedEffect

        val decision = if (manualRetryNonce > 0 && baseRoute == null) {
            app.vaicar.geo.RecalculationDecision(true, "manual_retry")
        } else {
            GeoNavigationEngine.shouldRecalculateRoute(
                currentPos = origin,
                currentAccuracyMeters = driverAccuracyMeters,
                activePolyline = baseRoute?.coords,
                lastRouteOrigin = lastRouteOrigin,
                target = target,
                lastRouteTarget = lastRouteTarget,
                lastCalculatedAtMs = lastCalculatedAtMs
            )
        }

        if (!decision.shouldRecalculate) {
            // Trim displayed polyline smoothly along road without re-querying API
            val currentBase = baseRoute
            if (currentBase != null && mode != MapNavMode.PLANNING) {
                val trimmed = GeoNavigationEngine.trimPolylineFromPosition(origin, currentBase.coords)
                if (trimmed != null) {
                    displayedCoords = trimmed.coords
                    val remKm = (trimmed.remainingDistanceMeters / 100.0).roundToInt() / 10.0
                    val ratio = if (currentBase.distanceKm > 0.05) {
                        (remKm / currentBase.distanceKm).coerceIn(0.05, 1.2)
                    } else {
                        1.0
                    }
                    val remMin = max(1, (currentBase.durationMinutes * ratio).roundToInt())
                    displayedDistanceKm = remKm
                    displayedDurationMin = remMin
                    onRouteUpdated?.invoke(
                        MapRouteSummary(
                            distanceKm = remKm,
                            durationMinutes = remMin,
                            isRerouting = false,
                            provider = currentBase.provider
                        )
                    )
                }
            }
            return@LaunchedEffect
        }

        routeLoading = true
        routeError = null
        if (decision.reason == "off_route") {
            rerouteCount += 1
        }
        try {
            val route = RouteRepository.getDrivingRoute(origin, target)
            baseRoute = route
            displayedCoords = route.coords
            displayedDistanceKm = route.distanceKm
            displayedDurationMin = route.durationMinutes
            lastRouteOrigin = origin
            lastRouteTarget = target
            lastCalculatedAtMs = System.currentTimeMillis()
            onRouteUpdated?.invoke(
                MapRouteSummary(
                    distanceKm = route.distanceKm,
                    durationMinutes = route.durationMinutes,
                    isRerouting = false,
                    provider = route.provider
                )
            )
        } catch (err: Exception) {
            routeError = err.message ?: "Não foi possível traçar a rota viária."
            if (baseRoute == null) {
                displayedCoords = emptyList()
                onRouteUpdated?.invoke(null)
            }
        } finally {
            routeLoading = false
        }
    }

    fun fitRelevantBounds(mv: MapView) {
        val points = mutableListOf<GeoPoint>()
        if (displayedCoords.size >= 2) {
            points.addAll(displayedCoords)
        }
        pickup?.let { points.add(it) }
        destination?.let { points.add(it) }
        driverLocation?.let { points.add(it) }
        if (points.isEmpty()) {
            userLocation?.let { points.add(it) }
        }
        if (points.size >= 2) {
            val north = points.maxOf { it.lat }
            val south = points.minOf { it.lat }
            val east = points.maxOf { it.lng }
            val west = points.minOf { it.lng }
            val padLat = max(0.004, (north - south) * 0.22)
            val padLng = max(0.004, (east - west) * 0.22)
            val bbox = BoundingBox(north + padLat, east + padLng, south - padLat, west - padLng)
            mv.post {
                runCatching { mv.zoomToBoundingBox(bbox, true, 64) }
            }
        } else if (points.size == 1) {
            val pt = points.first()
            mv.controller.animateTo(OsmGeoPoint(pt.lat, pt.lng), 15.5, 450L)
        } else {
            val c = GeoNavigationEngine.SAO_SEBASTIAO_CENTER
            mv.controller.animateTo(OsmGeoPoint(c.lat, c.lng), 13.5, 450L)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            mapViewRef?.onPause()
            mapViewRef?.onDetach()
            mapViewRef = null
        }
    }

    Box(modifier = modifier) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                MapView(ctx).apply {
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    isTilesScaledToDpi = true
                    controller.setZoom(14.0)
                    val startCenter = driverLocation ?: userLocation ?: pickup ?: GeoNavigationEngine.SAO_SEBASTIAO_CENTER
                    controller.setCenter(OsmGeoPoint(startCenter.lat, startCenter.lng))
                    onResume()
                    mapViewRef = this
                }
            },
            update = { mv ->
                mv.overlays.clear()

                if (onMapTap != null) {
                    mv.overlays.add(
                        MapEventsOverlay(object : MapEventsReceiver {
                            override fun singleTapConfirmedHelper(p: OsmGeoPoint?): Boolean {
                                if (p != null) {
                                    onMapTap(GeoPoint(p.latitude, p.longitude))
                                    return true
                                }
                                return false
                            }

                            override fun longPressHelper(p: OsmGeoPoint?): Boolean = false
                        })
                    )
                }

                // Real road polyline ONLY (never straight line)
                if (displayedCoords.size >= 2) {
                    val line = Polyline().apply {
                        setPoints(displayedCoords.map { OsmGeoPoint(it.lat, it.lng) })
                        outlinePaint.color = when (mode) {
                            MapNavMode.DRIVER_TO_PICKUP -> VaiCarColors.RouteCyan.toArgb()
                            MapNavMode.DRIVER_TO_DESTINATION -> VaiCarColors.Emerald.toArgb()
                            MapNavMode.PLANNING -> VaiCarColors.Forest.toArgb()
                        }
                        outlinePaint.strokeWidth = 11f
                        outlinePaint.strokeCap = Paint.Cap.ROUND
                        outlinePaint.strokeJoin = Paint.Join.ROUND
                    }
                    mv.overlays.add(line)
                }

                // Online drivers markers (only in planning mode)
                if (mode == MapNavMode.PLANNING) {
                    onlineDrivers.forEach { drv ->
                        val loc = drv.currentLocation
                        if (loc != null && GeoNavigationEngine.isValidCoordinate(loc.lat, loc.lng)) {
                            val marker = Marker(mv).apply {
                                position = OsmGeoPoint(loc.lat, loc.lng)
                                title = "${drv.name} • ${drv.vehicle?.model.orEmpty()}"
                                icon = onlineDriverDrawable
                                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            }
                            mv.overlays.add(marker)
                        }
                    }
                }

                // User GPS marker
                userLocation?.let { loc ->
                    if (GeoNavigationEngine.isValidCoordinate(loc.lat, loc.lng)) {
                        val marker = Marker(mv).apply {
                            position = OsmGeoPoint(loc.lat, loc.lng)
                            title = "Sua posição GPS"
                            icon = userDrawable
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        }
                        mv.overlays.add(marker)
                    }
                }

                // Pickup marker
                pickup?.let { pt ->
                    if (GeoNavigationEngine.isValidCoordinate(pt.lat, pt.lng)) {
                        val marker = Marker(mv).apply {
                            position = OsmGeoPoint(pt.lat, pt.lng)
                            title = "Embarque: $pickupLabel"
                            icon = pickupDrawable
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        }
                        mv.overlays.add(marker)
                    }
                }

                // Destination marker
                destination?.let { pt ->
                    if (GeoNavigationEngine.isValidCoordinate(pt.lat, pt.lng)) {
                        val marker = Marker(mv).apply {
                            position = OsmGeoPoint(pt.lat, pt.lng)
                            title = "Destino: $destinationLabel"
                            icon = destinationDrawable
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        }
                        mv.overlays.add(marker)
                    }
                }

                // Active Driver real GPS marker
                driverLocation?.let { pt ->
                    if (GeoNavigationEngine.isValidCoordinate(pt.lat, pt.lng)) {
                        val marker = Marker(mv).apply {
                            position = OsmGeoPoint(pt.lat, pt.lng)
                            title = if (driverStaleWarning) "Motorista (GPS sem atualização recente)" else "Motorista ao vivo"
                            icon = driverDrawable
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        }
                        mv.overlays.add(marker)
                    }
                }

                mv.invalidate()

                if (!hasAutoCentered && (displayedCoords.size >= 2 || pickup != null || userLocation != null || driverLocation != null)) {
                    hasAutoCentered = true
                    fitRelevantBounds(mv)
                }
            }
        )

        // Top floating route status HUD
        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (routeLoading) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = VaiCarColors.White.copy(alpha = 0.95f),
                    shadowElevation = 4.dp,
                    border = BorderStroke(1.dp, VaiCarColors.Border)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = VaiCarColors.Emerald
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = if (rerouteCount > 0) "Recalculando rota pelas ruas…" else "Calculando rota real…",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = VaiCarColors.Forest
                        )
                    }
                }
            } else if (displayedDistanceKm != null && displayedDurationMin != null) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = VaiCarColors.White.copy(alpha = 0.96f),
                    shadowElevation = 4.dp,
                    border = BorderStroke(1.dp, VaiCarColors.Border)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val badgeLabel = when (mode) {
                            MapNavMode.DRIVER_TO_PICKUP -> "Até embarque"
                            MapNavMode.DRIVER_TO_DESTINATION -> "Até destino"
                            MapNavMode.PLANNING -> "Rota"
                        }
                        Text(
                            text = "$badgeLabel • ${"%.1f".format(displayedDistanceKm)} km • ~${displayedDurationMin} min",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = VaiCarColors.Forest
                        )
                    }
                }
            }

            if (driverStaleWarning) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = VaiCarColors.AmberSoft,
                    border = BorderStroke(1.dp, VaiCarColors.Amber)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = VaiCarColors.Amber,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "GPS do motorista sem atualização recente.",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = VaiCarColors.Graphite
                        )
                    }
                }
            }

            if (routeError != null) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = VaiCarColors.RoseSoft,
                    border = BorderStroke(1.dp, VaiCarColors.Rose)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = routeError ?: "Erro ao traçar rota.",
                            fontSize = 11.sp,
                            color = VaiCarColors.Rose,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Spacer(Modifier.width(8.dp))
                        OutlinedButton(
                            onClick = { manualRetryNonce += 1 },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(13.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Tentar", fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // Right floating map controls (Recenter / My GPS)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SmallFloatingActionButton(
                onClick = { mapViewRef?.let { fitRelevantBounds(it) } },
                shape = CircleShape,
                containerColor = VaiCarColors.White,
                contentColor = VaiCarColors.Forest
            ) {
                Icon(Icons.Default.CenterFocusStrong, contentDescription = "Enquadrar rota")
            }

            val gpsTarget = driverLocation ?: userLocation
            if (gpsTarget != null) {
                SmallFloatingActionButton(
                    onClick = {
                        mapViewRef?.controller?.animateTo(
                            OsmGeoPoint(gpsTarget.lat, gpsTarget.lng),
                            16.5,
                            400L
                        )
                    },
                    shape = CircleShape,
                    containerColor = VaiCarColors.Emerald,
                    contentColor = VaiCarColors.White
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = "Centralizar no GPS")
                }
            }
        }

        // External turn-by-turn launcher (Google Maps / Waze) for active navigation
        if (showExternalNavButtons && activeTarget != null) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Button(
                    onClick = { openExternalNavigation(context, activeTarget.lat, activeTarget.lng, useWaze = false) },
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Forest),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("Google Maps", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(
                    onClick = { openExternalNavigation(context, activeTarget.lat, activeTarget.lng, useWaze = true) },
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = VaiCarColors.White.copy(alpha = 0.94f),
                        contentColor = VaiCarColors.Forest
                    ),
                    border = BorderStroke(1.dp, VaiCarColors.Border),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Text("Waze", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
