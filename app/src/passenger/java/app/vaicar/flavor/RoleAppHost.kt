package app.vaicar.flavor

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.vaicar.data.CancelRideRequest
import app.vaicar.data.DriverLocationDto
import app.vaicar.data.EstimateRideRequest
import app.vaicar.data.EstimateRideResultDto
import app.vaicar.data.LocationPointDto
import app.vaicar.data.PassengerProfileDto
import app.vaicar.data.ProfilePayload
import app.vaicar.data.PublicDriverMarkerDto
import app.vaicar.data.RateRideRequest
import app.vaicar.data.RequestRidePayload
import app.vaicar.data.RideDto
import app.vaicar.data.RouteRepository
import app.vaicar.data.UpdatePassengerRequest
import app.vaicar.data.VaiCarApiClient
import app.vaicar.data.VaiCarSession
import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import app.vaicar.geo.GpsTrackerStatus
import app.vaicar.geo.LocationTracker
import app.vaicar.ui.components.AddressSearchField
import app.vaicar.ui.components.MapNavMode
import app.vaicar.ui.components.StarRatingRow
import app.vaicar.ui.components.StatusPill
import app.vaicar.ui.components.VaiCarAuthCard
import app.vaicar.ui.components.VaiCarOsmMap
import app.vaicar.ui.components.computeWaitingRemainingSec
import app.vaicar.ui.components.extractApiError
import app.vaicar.ui.components.formatBrl
import app.vaicar.ui.components.formatCountdown
import app.vaicar.ui.components.rideStatusColors
import app.vaicar.ui.components.rideStatusLabel
import app.vaicar.ui.theme.VaiCarColors
import app.vaicar.util.NotificationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val ACTIVE_RIDE_STATUSES = setOf(
    "REQUESTED", "OFFERING", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_PROGRESS"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleAppHost() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var restoringSession by remember { mutableStateOf(VaiCarSession.token != null) }
    var profile by remember { mutableStateOf<ProfilePayload?>(null) }
    var passenger by remember { mutableStateOf<PassengerProfileDto?>(null) }
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    // Restore persisted session on launch
    LaunchedEffect(Unit) {
        if (VaiCarSession.token != null) {
            try {
                val res = VaiCarApiClient.service.me()
                if (res.success && res.data != null) {
                    profile = res.data
                    passenger = res.data.passenger
                } else {
                    VaiCarSession.clear(context)
                }
            } catch (_: Exception) {
                VaiCarSession.clear(context)
            }
        }
        restoringSession = false
    }

    if (restoringSession) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(VaiCarColors.Background),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = VaiCarColors.Emerald)
                Spacer(Modifier.height(12.dp))
                Text("Restaurando sessão VaiCar Passageiro…", color = VaiCarColors.Forest, fontSize = 13.sp)
            }
        }
        return
    }

    if (profile == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(VaiCarColors.Background)
                .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.Center
        ) {
            VaiCarAuthCard(
                appTitle = "VaiCar Passageiro",
                subtitle = "Mobilidade inteligente em São Sebastião",
                registerPath = "/register/passenger",
                registerButtonLabel = "Criar conta de passageiro",
                accentColor = VaiCarColors.Emerald,
                onAuthenticated = { loaded ->
                    profile = loaded
                    passenger = loaded.passenger
                }
            )
        }
        return
    }

    // Authenticated Passenger Shell
    val tracker = remember(context) { LocationTracker(context) }
    val gpsState by tracker.state.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        tracker.refreshPermissionState()
        if (tracker.hasLocationPermission()) {
            tracker.start()
        }
    }

    LaunchedEffect(Unit) {
        if (tracker.hasLocationPermission()) {
            tracker.start()
        } else {
            val perms = buildList {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    add(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            permissionLauncher.launch(perms.toTypedArray())
        }
    }

    DisposableEffect(tracker) {
        onDispose { tracker.stop() }
    }

    // Core Ride State
    var pickupText by rememberSaveable { mutableStateOf("") }
    var destText by rememberSaveable { mutableStateOf("") }
    var pickupPoint by remember { mutableStateOf<LocationPointDto?>(null) }
    var destPoint by remember { mutableStateOf<LocationPointDto?>(null) }
    var mapPickTarget by rememberSaveable { mutableStateOf("none") } // "none" | "pickup" | "dest"
    var paymentMethod by rememberSaveable { mutableStateOf("PIX") }
    var selectedDriverId by rememberSaveable { mutableStateOf<String?>(null) }

    var estimate by remember { mutableStateOf<EstimateRideResultDto?>(null) }
    var estimating by remember { mutableStateOf(false) }
    var onlineDrivers by remember { mutableStateOf<List<PublicDriverMarkerDto>>(emptyList()) }

    var activeRide by remember { mutableStateOf<RideDto?>(null) }
    var liveDriverLoc by remember { mutableStateOf<DriverLocationDto?>(null) }
    var driverLocStale by remember { mutableStateOf(false) }
    var lastNotifiedStatus by remember { mutableStateOf<String?>(null) }
    var waitingSec by remember { mutableIntStateOf(240) }

    var pendingRateRide by remember { mutableStateOf<RideDto?>(null) }
    var selectedStars by remember { mutableIntStateOf(5) }
    var ratingBusy by remember { mutableStateOf(false) }

    var history by remember { mutableStateOf<List<RideDto>>(emptyList()) }
    var historyLoading by remember { mutableStateOf(false) }

    var actionBusy by remember { mutableStateOf(false) }
    var bannerMessage by remember { mutableStateOf<String?>(null) }
    var bannerIsError by remember { mutableStateOf(false) }

    // Initial active ride & online drivers load
    LaunchedEffect(Unit) {
        runCatching {
            val active = VaiCarApiClient.service.passengerActiveRide().data
            if (active != null && active.status in ACTIVE_RIDE_STATUSES) {
                activeRide = active
                lastNotifiedStatus = active.status
            }
        }
        runCatching {
            onlineDrivers = VaiCarApiClient.service.onlineDrivers().data.orEmpty()
        }
    }

    // Auto-fill pickup from real GPS once (only if user hasn't typed yet and within São Sebastião)
    var gpsAutoFilled by remember { mutableStateOf(false) }
    LaunchedEffect(gpsState.sample) {
        val sample = gpsState.sample ?: return@LaunchedEffect
        if (!gpsAutoFilled && pickupPoint == null && pickupText.isBlank() && activeRide == null) {
            if (GeoNavigationEngine.isWithinOperationalArea(sample.lat, sample.lng)) {
                gpsAutoFilled = true
                val addr = RouteRepository.reverseGeocode(sample.lat, sample.lng)
                pickupText = addr
                pickupPoint = LocationPointDto(addr, sample.lat, sample.lng)
            }
        }
    }

    // Refresh estimate whenever confirmed pickup & destination change (planning only)
    LaunchedEffect(pickupPoint, destPoint, activeRide?.id) {
        if (activeRide != null) return@LaunchedEffect
        val orig = pickupPoint
        val dest = destPoint
        if (orig == null || dest == null) {
            estimate = null
            return@LaunchedEffect
        }
        estimating = true
        bannerMessage = null
        try {
            val res = VaiCarApiClient.service.estimateRide(
                EstimateRideRequest(origin = orig, destination = dest)
            )
            if (res.success && res.data != null) {
                estimate = res.data
            } else {
                estimate = null
                bannerIsError = true
                bannerMessage = res.error?.message ?: "Não foi possível estimar o valor da corrida."
            }
        } catch (ex: Exception) {
            estimate = null
            bannerIsError = true
            bannerMessage = extractApiError(ex)
        } finally {
            estimating = false
        }
    }

    // Poll online drivers in planning mode every 12s
    LaunchedEffect(activeRide?.id, selectedTab) {
        while (activeRide == null && selectedTab == 0) {
            runCatching {
                onlineDrivers = VaiCarApiClient.service.onlineDrivers().data.orEmpty()
            }
            tracker.checkSignalFreshness()
            delay(12_000L)
        }
    }

    // Live active ride sync loop (polls /rides/:id + /rides/:id/driver-location every 3s)
    LaunchedEffect(activeRide?.id) {
        val rideId = activeRide?.id ?: return@LaunchedEffect
        while (true) {
            try {
                val rideRes = VaiCarApiClient.service.getRide(rideId)
                val latest = rideRes.data
                if (latest != null) {
                    if (lastNotifiedStatus != null && lastNotifiedStatus != latest.status) {
                        NotificationHelper.notifyRideEvent(
                            context = context,
                            id = rideId.hashCode(),
                            title = "VaiCar: ${rideStatusLabel(latest.status)}",
                            message = when (latest.status) {
                                "DRIVER_ARRIVING", "ACCEPTED" -> "${latest.driverName ?: "Motorista"} aceitou e está a caminho."
                                "ARRIVED" -> "${latest.driverName ?: "Seu motorista"} chegou ao ponto de embarque!"
                                "IN_PROGRESS" -> "Viagem iniciada rumo a ${latest.destination.address}."
                                "COMPLETED" -> "Corrida finalizada (${formatBrl(latest.fareAmount)}). Avalie seu motorista!"
                                else -> "Status atualizado: ${rideStatusLabel(latest.status)}"
                            }
                        )
                    }
                    lastNotifiedStatus = latest.status

                    if (latest.status !in ACTIVE_RIDE_STATUSES) {
                        if (latest.status == "COMPLETED" && latest.ratingByPassenger == null) {
                            pendingRateRide = latest
                        }
                        activeRide = null
                        liveDriverLoc = null
                        driverLocStale = false
                        bannerIsError = latest.status.startsWith("CANCEL") || latest.status == "NO_DRIVER_AVAILABLE"
                        bannerMessage = "Corrida encerrada: ${rideStatusLabel(latest.status)}."
                        break
                    } else {
                        activeRide = latest
                    }

                    if (latest.driverId != null) {
                        val locRes = runCatching {
                            VaiCarApiClient.service.getRideDriverLocation(rideId)
                        }.getOrNull()
                        val loc = locRes?.driverLocation ?: latest.driverLocation
                        if (loc != null && GeoNavigationEngine.isValidCoordinate(loc.lat, loc.lng)) {
                            liveDriverLoc = loc
                            driverLocStale = loc.isStale == true ||
                                (loc.updatedAt != null && !GeoNavigationEngine.isGpsFresh(loc.updatedAt))
                        }
                    }
                }
            } catch (_: Exception) {
                // Retry on next cycle
            }
            delay(3_000L)
        }
    }

    // 4-min waiting timer ticker when ARRIVED
    LaunchedEffect(activeRide?.status, activeRide?.waitingTimerStartedAt, activeRide?.arrivedAt) {
        val ride = activeRide ?: return@LaunchedEffect
        if (ride.status != "ARRIVED") return@LaunchedEffect
        while (activeRide?.status == "ARRIVED") {
            waitingSec = computeWaitingRemainingSec(ride.waitingTimerStartedAt, ride.arrivedAt)
            delay(1_000L)
        }
    }

    // Load ride history when switching to tab 1
    LaunchedEffect(selectedTab) {
        if (selectedTab == 1) {
            historyLoading = true
            runCatching {
                history = VaiCarApiClient.service.passengerRides().data.orEmpty()
            }
            historyLoading = false
        }
    }

    Scaffold(
        containerColor = VaiCarColors.Background,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = VaiCarColors.White,
                    titleContentColor = VaiCarColors.Forest
                ),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("VaiCar Passageiro", fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Spacer(Modifier.width(8.dp))
                        val gpsPillColor = when (gpsState.status) {
                            GpsTrackerStatus.ACTIVE -> VaiCarColors.EmeraldSoft to VaiCarColors.EmeraldDark
                            GpsTrackerStatus.LOW_ACCURACY, GpsTrackerStatus.ACQUIRING -> VaiCarColors.AmberSoft to VaiCarColors.Amber
                            else -> VaiCarColors.RoseSoft to VaiCarColors.Rose
                        }
                        val gpsLabel = when (gpsState.status) {
                            GpsTrackerStatus.ACTIVE -> "GPS OK"
                            GpsTrackerStatus.LOW_ACCURACY -> "GPS ±${gpsState.sample?.accuracy?.toInt() ?: 0}m"
                            GpsTrackerStatus.ACQUIRING -> "Buscando GPS"
                            GpsTrackerStatus.PERMISSION_REQUIRED -> "Sem permissão"
                            else -> "Sem sinal"
                        }
                        StatusPill(gpsLabel, gpsPillColor.first, gpsPillColor.second)
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar(containerColor = VaiCarColors.White) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.DirectionsCar, contentDescription = null) },
                    label = { Text("Viajar") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.History, contentDescription = null) },
                    label = { Text("Histórico") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("Perfil") }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedTab) {
                0 -> {
                    val ride = activeRide
                    val mapMode = when (ride?.status) {
                        "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED" -> MapNavMode.DRIVER_TO_PICKUP
                        "IN_PROGRESS" -> MapNavMode.DRIVER_TO_DESTINATION
                        else -> MapNavMode.PLANNING
                    }
                    val mapPickup = ride?.origin?.let { GeoPoint(it.lat, it.lng) }
                        ?: pickupPoint?.let { GeoPoint(it.lat, it.lng) }
                    val mapDest = ride?.destination?.let { GeoPoint(it.lat, it.lng) }
                        ?: destPoint?.let { GeoPoint(it.lat, it.lng) }
                    val mapUser = gpsState.sample?.let { GeoPoint(it.lat, it.lng) }
                    val mapDriver = liveDriverLoc?.let { GeoPoint(it.lat, it.lng) }

                    Column(modifier = Modifier.fillMaxSize()) {
                        // Interactive OSM Map (top section)
                        VaiCarOsmMap(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(0.46f),
                            mode = mapMode,
                            pickup = mapPickup,
                            pickupLabel = ride?.origin?.address ?: pickupPoint?.address ?: "Embarque",
                            destination = mapDest,
                            destinationLabel = ride?.destination?.address ?: destPoint?.address ?: "Destino",
                            userLocation = mapUser,
                            driverLocation = mapDriver,
                            driverAccuracyMeters = liveDriverLoc?.accuracy?.toFloat(),
                            driverStaleWarning = driverLocStale,
                            onlineDrivers = onlineDrivers,
                            onMapTap = if (ride == null && mapPickTarget != "none") {
                                { tapped ->
                                    val check = GeoNavigationEngine.validateOperationalPoint(tapped.lat, tapped.lng)
                                    if (!check.valid) {
                                        bannerIsError = true
                                        bannerMessage = check.message
                                    } else {
                                        val targetKind = mapPickTarget
                                        mapPickTarget = "none"
                                        scope.launch {
                                            val addr = RouteRepository.reverseGeocode(tapped.lat, tapped.lng)
                                            val pt = LocationPointDto(addr, tapped.lat, tapped.lng)
                                            if (targetKind == "pickup") {
                                                pickupText = addr
                                                pickupPoint = pt
                                            } else {
                                                destText = addr
                                                destPoint = pt
                                            }
                                            bannerMessage = null
                                        }
                                    }
                                }
                            } else null
                        )

                        // Bottom interactive sheet
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(0.54f),
                            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                            color = VaiCarColors.White,
                            shadowElevation = 8.dp
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .verticalScroll(rememberScrollState())
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                if (!gpsState.hasPermission) {
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = VaiCarColors.AmberSoft,
                                        border = BorderStroke(1.dp, VaiCarColors.Amber)
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                "Ative o GPS para preencher seu embarque automaticamente.",
                                                fontSize = 12.sp,
                                                color = VaiCarColors.Graphite,
                                                modifier = Modifier.weight(1f)
                                            )
                                            Spacer(Modifier.width(8.dp))
                                            Button(
                                                onClick = {
                                                    permissionLauncher.launch(
                                                        arrayOf(
                                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                                        )
                                                    )
                                                },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                            ) {
                                                Text("Permitir", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }

                                if (bannerMessage != null) {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = if (bannerIsError) VaiCarColors.RoseSoft else VaiCarColors.EmeraldSoft,
                                        border = BorderStroke(1.dp, if (bannerIsError) VaiCarColors.Rose else VaiCarColors.Emerald)
                                    ) {
                                        Text(
                                            text = bannerMessage!!,
                                            color = if (bannerIsError) VaiCarColors.Rose else VaiCarColors.Forest,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp)
                                        )
                                    }
                                }

                                // Post-ride rating card
                                val toRate = pendingRateRide
                                if (toRate != null && ride == null) {
                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = VaiCarColors.SurfaceVariant,
                                        border = BorderStroke(1.dp, VaiCarColors.Emerald)
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(
                                                "Como foi sua viagem com ${toRate.driverName ?: "o motorista"}?",
                                                fontWeight = FontWeight.Bold,
                                                color = VaiCarColors.Forest
                                            )
                                            StarRatingRow(rating = selectedStars, onRatingSelected = { selectedStars = it })
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    enabled = !ratingBusy,
                                                    onClick = {
                                                        ratingBusy = true
                                                        scope.launch {
                                                            runCatching {
                                                                VaiCarApiClient.service.rateDriver(
                                                                    toRate.id,
                                                                    RateRideRequest(rating = selectedStars)
                                                                )
                                                            }
                                                            pendingRateRide = null
                                                            ratingBusy = false
                                                            bannerIsError = false
                                                            bannerMessage = "Avaliação enviada com sucesso! Obrigado."
                                                        }
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                                ) {
                                                    Text("Enviar avaliação")
                                                }
                                                OutlinedButton(onClick = { pendingRateRide = null }) {
                                                    Text("Depois")
                                                }
                                            }
                                        }
                                    }
                                }

                                if (ride != null) {
                                    // ACTIVE RIDE PANEL
                                    val (bg, fg) = rideStatusColors(ride.status)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        StatusPill(rideStatusLabel(ride.status), bg, fg)
                                        Text(
                                            formatBrl(ride.fareAmount),
                                            fontWeight = FontWeight.Black,
                                            fontSize = 18.sp,
                                            color = VaiCarColors.Forest
                                        )
                                    }

                                    if (ride.status == "ARRIVED") {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = VaiCarColors.EmeraldSoft
                                        ) {
                                            Text(
                                                "Motorista aguardando no embarque • Tempo de espera: ${formatCountdown(waitingSec)}",
                                                color = VaiCarColors.Forest,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(10.dp)
                                            )
                                        }
                                    }

                                    if (ride.driverName != null) {
                                        Surface(
                                            shape = RoundedCornerShape(14.dp),
                                            color = VaiCarColors.SurfaceVariant
                                        ) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(12.dp),
                                                verticalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                Text(
                                                    ride.driverName,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 15.sp,
                                                    color = VaiCarColors.Forest
                                                )
                                                val veh = ride.vehicle
                                                if (veh != null) {
                                                    Text(
                                                        "${veh.brand} ${veh.model} • ${veh.color} • Placa ${veh.plate}",
                                                        fontSize = 12.sp,
                                                        color = VaiCarColors.Graphite
                                                    )
                                                }
                                                val age = liveDriverLoc?.updatedAt?.let {
                                                    GeoNavigationEngine.formatTelemetryAge(it)
                                                } ?: "aguardando sinal"
                                                Text(
                                                    "GPS do motorista: $age",
                                                    fontSize = 11.sp,
                                                    color = if (driverLocStale) VaiCarColors.Amber else VaiCarColors.Muted
                                                )
                                            }
                                        }
                                    } else {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(16.dp),
                                                strokeWidth = 2.dp,
                                                color = VaiCarColors.Emerald
                                            )
                                            Spacer(Modifier.width(8.dp))
                                            Text(
                                                "Buscando motoristas disponíveis em São Sebastião…",
                                                fontSize = 13.sp,
                                                color = VaiCarColors.Muted
                                            )
                                        }
                                    }

                                    Text("Embarque: ${ride.origin.address}", fontSize = 12.sp, color = VaiCarColors.Graphite)
                                    Text("Destino: ${ride.destination.address}", fontSize = 12.sp, color = VaiCarColors.Graphite)
                                    Text("Pagamento: ${ride.paymentMethod}", fontSize = 12.sp, color = VaiCarColors.Muted)

                                    if (ride.status in setOf("REQUESTED", "OFFERING", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED")) {
                                        OutlinedButton(
                                            enabled = !actionBusy,
                                            onClick = {
                                                actionBusy = true
                                                scope.launch {
                                                    try {
                                                        VaiCarApiClient.service.cancelRide(
                                                            ride.id,
                                                            CancelRideRequest(reason = "Cancelado pelo passageiro no app")
                                                        )
                                                        activeRide = null
                                                        liveDriverLoc = null
                                                        bannerIsError = false
                                                        bannerMessage = "Corrida cancelada."
                                                    } catch (ex: Exception) {
                                                        bannerIsError = true
                                                        bannerMessage = extractApiError(ex)
                                                    } finally {
                                                        actionBusy = false
                                                    }
                                                }
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            border = BorderStroke(1.dp, VaiCarColors.Rose)
                                        ) {
                                            Text("Cancelar corrida", color = VaiCarColors.Rose, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                } else {
                                    // PLANNING & REQUEST FORM (FREE-TEXT SEARCH ONLY, ZERO PRESET LISTS)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "Para onde vamos?",
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Black,
                                            color = VaiCarColors.Forest
                                        )
                                        Text(
                                            "${onlineDrivers.size} online",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = VaiCarColors.EmeraldDark
                                        )
                                    }

                                    AddressSearchField(
                                        label = "Embarque",
                                        placeholder = "Digite seu endereço ou use o GPS",
                                        value = pickupText,
                                        confirmedPoint = pickupPoint,
                                        onTextChange = {
                                            pickupText = it
                                            pickupPoint = null
                                        },
                                        onPointSelected = { pt ->
                                            pickupText = pt.address
                                            pickupPoint = pt
                                        },
                                        onClear = {
                                            pickupText = ""
                                            pickupPoint = null
                                        },
                                        gpsAvailable = gpsState.sample != null,
                                        onUseGpsClick = {
                                            val sample = gpsState.sample ?: return@AddressSearchField
                                            val check = GeoNavigationEngine.validateOperationalPoint(sample.lat, sample.lng, "Seu GPS")
                                            if (!check.valid) {
                                                bannerIsError = true
                                                bannerMessage = check.message
                                            } else {
                                                scope.launch {
                                                    val addr = RouteRepository.reverseGeocode(sample.lat, sample.lng)
                                                    pickupText = addr
                                                    pickupPoint = LocationPointDto(addr, sample.lat, sample.lng)
                                                    bannerMessage = null
                                                }
                                            }
                                        }
                                    )

                                    AddressSearchField(
                                        label = "Destino",
                                        placeholder = "Digite rua, bairro ou ponto em São Sebastião",
                                        value = destText,
                                        confirmedPoint = destPoint,
                                        onTextChange = {
                                            destText = it
                                            destPoint = null
                                        },
                                        onPointSelected = { pt ->
                                            destText = pt.address
                                            destPoint = pt
                                        },
                                        onClear = {
                                            destText = ""
                                            destPoint = null
                                        }
                                    )

                                    // Map pin selection mode chips
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(
                                            selected = mapPickTarget == "pickup",
                                            onClick = { mapPickTarget = if (mapPickTarget == "pickup") "none" else "pickup" },
                                            label = { Text("Marcar embarque no mapa", fontSize = 11.sp) },
                                            leadingIcon = { Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(14.dp)) }
                                        )
                                        FilterChip(
                                            selected = mapPickTarget == "dest",
                                            onClick = { mapPickTarget = if (mapPickTarget == "dest") "none" else "dest" },
                                            label = { Text("Marcar destino", fontSize = 11.sp) }
                                        )
                                    }

                                    if (estimating) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = VaiCarColors.Emerald)
                                            Spacer(Modifier.width(8.dp))
                                            Text("Calculando tarifa e motoristas próximos…", fontSize = 12.sp, color = VaiCarColors.Muted)
                                        }
                                    }

                                    val est = estimate
                                    if (est != null) {
                                        Surface(
                                            shape = RoundedCornerShape(16.dp),
                                            color = VaiCarColors.EmeraldSoft,
                                            border = BorderStroke(1.dp, VaiCarColors.Emerald)
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(12.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column {
                                                    Text("Estimativa VaiCar", fontSize = 12.sp, color = VaiCarColors.Forest)
                                                    Text(
                                                        "${"%.1f".format(est.distanceKm)} km • ~${est.durationMinutes} min",
                                                        fontSize = 12.sp,
                                                        color = VaiCarColors.Muted
                                                    )
                                                }
                                                Text(
                                                    formatBrl(est.fareAmount),
                                                    fontSize = 22.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = VaiCarColors.Forest
                                                )
                                            }
                                        }

                                        if (est.availableDrivers.isNotEmpty()) {
                                            Text("Motoristas disponíveis", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                                            est.availableDrivers.take(3).forEach { drv ->
                                                val chosen = selectedDriverId == drv.driverId
                                                Surface(
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .clickable {
                                                            selectedDriverId = if (chosen) null else drv.driverId
                                                        },
                                                    shape = RoundedCornerShape(12.dp),
                                                    color = if (chosen) VaiCarColors.EmeraldSoft else VaiCarColors.White,
                                                    border = BorderStroke(1.dp, if (chosen) VaiCarColors.Emerald else VaiCarColors.Border)
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(10.dp),
                                                        horizontalArrangement = Arrangement.SpaceBetween,
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Column {
                                                            Text(drv.name, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                                            Text(
                                                                "${drv.vehicle?.model ?: "Veículo"} • ~${drv.etaMinutes} min • ★ ${"%.1f".format(drv.rating)}",
                                                                fontSize = 11.sp,
                                                                color = VaiCarColors.Muted
                                                            )
                                                        }
                                                        Text(
                                                            if (chosen) "Selecionado" else formatBrl(drv.fareAmount),
                                                            fontSize = 12.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = VaiCarColors.EmeraldDark
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        // Payment method selector
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            listOf("PIX" to "PIX", "CARD_MACHINE" to "Cartão", "CASH" to "Dinheiro").forEach { (code, label) ->
                                                FilterChip(
                                                    selected = paymentMethod == code,
                                                    onClick = { paymentMethod = code },
                                                    label = { Text(label, fontSize = 12.sp) }
                                                )
                                            }
                                        }

                                        Button(
                                            enabled = !actionBusy && pickupPoint != null && destPoint != null,
                                            onClick = {
                                                val orig = pickupPoint ?: return@Button
                                                val dest = destPoint ?: return@Button
                                                actionBusy = true
                                                bannerMessage = null
                                                scope.launch {
                                                    try {
                                                        val res = VaiCarApiClient.service.requestRide(
                                                            RequestRidePayload(
                                                                origin = orig,
                                                                destination = dest,
                                                                paymentMethod = paymentMethod,
                                                                requestedDriverId = selectedDriverId
                                                            )
                                                        )
                                                        if (res.success && res.data != null) {
                                                            activeRide = res.data
                                                            lastNotifiedStatus = res.data.status
                                                            estimate = null
                                                        } else {
                                                            bannerIsError = true
                                                            bannerMessage = res.error?.message ?: "Não foi possível solicitar a corrida."
                                                        }
                                                    } catch (ex: Exception) {
                                                        bannerIsError = true
                                                        bannerMessage = extractApiError(ex)
                                                    } finally {
                                                        actionBusy = false
                                                    }
                                                }
                                            },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(52.dp),
                                            shape = RoundedCornerShape(14.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                        ) {
                                            Text(
                                                if (actionBusy) "Solicitando…" else "Confirmar e pedir VaiCar",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 15.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // RIDE HISTORY TAB
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Histórico de corridas", fontSize = 18.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                            IconButton(onClick = {
                                scope.launch {
                                    historyLoading = true
                                    runCatching { history = VaiCarApiClient.service.passengerRides().data.orEmpty() }
                                    historyLoading = false
                                }
                            }) {
                                Icon(Icons.Default.Refresh, contentDescription = "Atualizar", tint = VaiCarColors.Forest)
                            }
                        }

                        if (historyLoading) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = VaiCarColors.Emerald)
                            }
                        } else if (history.isEmpty()) {
                            Text("Você ainda não realizou corridas pelo VaiCar.", color = VaiCarColors.Muted, fontSize = 13.sp)
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(history, key = { it.id }) { item ->
                                    val (bg, fg) = rideStatusColors(item.status)
                                    Surface(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        color = VaiCarColors.White,
                                        border = BorderStroke(1.dp, VaiCarColors.Border)
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                StatusPill(rideStatusLabel(item.status), bg, fg)
                                                Text(formatBrl(item.fareAmount), fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                                            }
                                            Text("De: ${item.origin.address}", fontSize = 12.sp)
                                            Text("Para: ${item.destination.address}", fontSize = 12.sp)
                                            if (item.driverName != null) {
                                                Text("Motorista: ${item.driverName}", fontSize = 11.sp, color = VaiCarColors.Muted)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                2 -> {
                    // PROFILE TAB
                    var editName by remember(passenger) { mutableStateOf(passenger?.name ?: profile?.user?.displayName.orEmpty()) }
                    var editPhone by remember(passenger) { mutableStateOf(passenger?.whatsapp ?: profile?.user?.whatsapp.orEmpty()) }
                    var saveMsg by remember { mutableStateOf<String?>(null) }
                    var saving by remember { mutableStateOf(false) }

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Meu Perfil", fontSize = 20.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            color = VaiCarColors.White,
                            border = BorderStroke(1.dp, VaiCarColors.Border)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    profile?.user?.email ?: passenger?.email.orEmpty(),
                                    fontSize = 13.sp,
                                    color = VaiCarColors.Muted
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Nota: ★ ${"%.1f".format(passenger?.rating ?: 5.0)}", fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                                    Text("Corridas: ${passenger?.totalRides ?: 0}", fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                                }
                                passenger?.referralCode?.let { code ->
                                    Text("Código de indicação: $code", fontSize = 12.sp, color = VaiCarColors.EmeraldDark, fontWeight = FontWeight.Bold)
                                }

                                HorizontalDivider(color = VaiCarColors.SurfaceVariant)

                                OutlinedTextField(
                                    value = editName,
                                    onValueChange = { editName = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    label = { Text("Nome completo") },
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = editPhone,
                                    onValueChange = { editPhone = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    label = { Text("WhatsApp") },
                                    singleLine = true
                                )

                                if (saveMsg != null) {
                                    Text(saveMsg!!, fontSize = 12.sp, color = VaiCarColors.EmeraldDark)
                                }

                                Button(
                                    enabled = !saving && editName.isNotBlank(),
                                    onClick = {
                                        saving = true
                                        saveMsg = null
                                        scope.launch {
                                            try {
                                                val res = VaiCarApiClient.service.updatePassengerMe(
                                                    UpdatePassengerRequest(name = editName.trim(), whatsapp = editPhone.trim())
                                                )
                                                if (res.success && res.data != null) {
                                                    passenger = res.data
                                                    saveMsg = "Perfil atualizado com sucesso."
                                                }
                                            } catch (ex: Exception) {
                                                saveMsg = extractApiError(ex)
                                            } finally {
                                                saving = false
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                ) {
                                    Text(if (saving) "Salvando…" else "Salvar alterações")
                                }
                            }
                        }

                        OutlinedButton(
                            onClick = {
                                tracker.stop()
                                VaiCarSession.clear(context)
                                profile = null
                                passenger = null
                                activeRide = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                            border = BorderStroke(1.dp, VaiCarColors.Rose)
                        ) {
                            Text("Sair da conta", color = VaiCarColors.Rose, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
