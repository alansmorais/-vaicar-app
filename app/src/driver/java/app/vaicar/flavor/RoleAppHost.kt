package app.vaicar.flavor

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import app.vaicar.data.CompleteRideRequest
import app.vaicar.data.DriverProfileDto
import app.vaicar.data.ProfilePayload
import app.vaicar.data.RateRideRequest
import app.vaicar.data.RideDto
import app.vaicar.data.RideOfferDto
import app.vaicar.data.ToggleOnlineRequest
import app.vaicar.data.UpdateDriverLocationRequest
import app.vaicar.data.VaiCarApiClient
import app.vaicar.data.VaiCarSession
import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.geo.GeoPoint
import app.vaicar.geo.GpsTrackerStatus
import app.vaicar.geo.LocationTracker
import app.vaicar.geo.TransmittedLocation
import app.vaicar.ui.components.MapNavMode
import app.vaicar.ui.components.StarRatingRow
import app.vaicar.ui.components.StatusPill
import app.vaicar.ui.components.VaiCarAuthCard
import app.vaicar.ui.components.VaiCarOsmMap
import app.vaicar.ui.components.computeWaitingRemainingSec
import app.vaicar.ui.components.extractApiError
import app.vaicar.ui.components.formatBrl
import app.vaicar.ui.components.formatCountdown
import app.vaicar.ui.components.openPortalUrl
import app.vaicar.ui.components.rideStatusColors
import app.vaicar.ui.components.rideStatusLabel
import app.vaicar.ui.theme.VaiCarColors
import app.vaicar.util.NotificationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val DRIVER_ACTIVE_STATUSES = setOf("ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_PROGRESS")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleAppHost() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var restoringSession by remember { mutableStateOf(VaiCarSession.token != null) }
    var profile by remember { mutableStateOf<ProfilePayload?>(null) }
    var driver by remember { mutableStateOf<DriverProfileDto?>(null) }
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        if (VaiCarSession.token != null) {
            try {
                val res = VaiCarApiClient.service.me()
                if (res.success && res.data != null) {
                    profile = res.data
                    driver = res.data.driver
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
                CircularProgressIndicator(color = VaiCarColors.Forest)
                Spacer(Modifier.height(12.dp))
                Text("Restaurando sessão VaiCar Motorista…", color = VaiCarColors.Forest, fontSize = 13.sp)
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
                appTitle = "VaiCar Motorista",
                subtitle = "Painel do motorista parceiro • São Sebastião",
                registerPath = "/register/driver",
                registerButtonLabel = "Cadastrar como motorista parceiro",
                accentColor = VaiCarColors.Forest,
                onAuthenticated = { loaded ->
                    profile = loaded
                    driver = loaded.driver
                }
            )
        }
        return
    }

    val currentDriver = driver
    if (currentDriver == null) {
        // Logged in as passenger only — no driver profile yet
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(VaiCarColors.Background)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = VaiCarColors.White,
                border = BorderStroke(1.dp, VaiCarColors.Border)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Perfil de Motorista não encontrado", fontSize = 18.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                    Text(
                        "Sua conta (${profile?.user?.email.orEmpty()}) ainda não possui cadastro de motorista parceiro. Conclua seu cadastro com CNH e veículo para dirigir no VaiCar.",
                        fontSize = 13.sp,
                        color = VaiCarColors.Graphite
                    )
                    Button(
                        onClick = { openPortalUrl(context, "/register/driver") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Forest)
                    ) {
                        Text("Completar cadastro de motorista")
                    }
                    OutlinedButton(
                        onClick = {
                            VaiCarSession.clear(context)
                            profile = null
                            driver = null
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Trocar de conta")
                    }
                }
            }
        }
        return
    }

    // Authenticated Driver Shell
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

    DisposableEffect(tracker) {
        onDispose { tracker.stop() }
    }

    var isOnline by remember(currentDriver.uid) { mutableStateOf(currentDriver.isOnline) }
    var activeRide by remember { mutableStateOf<RideDto?>(null) }
    var pendingOffer by remember { mutableStateOf<RideOfferDto?>(null) }
    var lastNotifiedOfferId by remember { mutableStateOf<String?>(null) }
    var lastTransmitted by remember { mutableStateOf<TransmittedLocation?>(null) }
    var waitingSec by remember { mutableIntStateOf(240) }

    var completedRideToFinalize by remember { mutableStateOf<RideDto?>(null) }
    var passengerStars by remember { mutableIntStateOf(5) }

    var history by remember { mutableStateOf<List<RideDto>>(emptyList()) }
    var historyLoading by remember { mutableStateOf(false) }

    var actionBusy by remember { mutableStateOf(false) }
    var bannerMsg by remember { mutableStateOf<String?>(null) }
    var bannerIsError by remember { mutableStateOf(false) }

    val isApproved = currentDriver.status == "APPROVED"

    // Initial load: driver profile refresh + active ride check
    LaunchedEffect(Unit) {
        runCatching {
            VaiCarApiClient.service.driverMe().data?.let {
                driver = it
                isOnline = it.isOnline
            }
        }
        runCatching {
            val active = VaiCarApiClient.service.driverActiveRide().data
            if (active != null && active.status in DRIVER_ACTIVE_STATUSES) {
                activeRide = active
            }
        }
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

    // Start/stop real GPS depending on online or active ride state
    LaunchedEffect(isOnline, activeRide?.id, gpsState.hasPermission) {
        if ((isOnline || activeRide != null) && gpsState.hasPermission) {
            tracker.start()
        }
    }

    // Transmit REAL GPS coordinates (throttled via GeoNavigationEngine) to backend & active ride
    LaunchedEffect(gpsState.sample, isOnline, activeRide?.id) {
        val sample = gpsState.sample ?: return@LaunchedEffect
        if (!isOnline && activeRide == null) return@LaunchedEffect

        val currentPt = GeoPoint(sample.lat, sample.lng)
        if (!GeoNavigationEngine.shouldTransmitDriverLocation(lastTransmitted, currentPt)) {
            return@LaunchedEffect
        }

        val payload = UpdateDriverLocationRequest(
            lat = sample.lat,
            lng = sample.lng,
            heading = sample.heading?.toDouble() ?: 0.0,
            speed = sample.speed?.toDouble(),
            accuracy = sample.accuracy?.toDouble()
        )
        runCatching {
            VaiCarApiClient.service.updateDriverLocation(payload)
            lastTransmitted = TransmittedLocation(sample.lat, sample.lng, System.currentTimeMillis())
        }
        val rideId = activeRide?.id
        if (rideId != null) {
            runCatching {
                VaiCarApiClient.service.postRideDriverLocation(rideId, payload)
            }
        }
    }

    // Poll incoming offers every 3s while online, approved, and idle
    LaunchedEffect(isOnline, isApproved, activeRide?.id) {
        if (!isOnline || !isApproved || activeRide != null) {
            pendingOffer = null
            return@LaunchedEffect
        }
        while (isOnline && isApproved && activeRide == null) {
            try {
                val offer = VaiCarApiClient.service.pendingOffer().data
                pendingOffer = offer
                if (offer != null && offer.id != lastNotifiedOfferId) {
                    lastNotifiedOfferId = offer.id
                    NotificationHelper.notifyRideEvent(
                        context = context,
                        id = offer.id.hashCode(),
                        title = "Nova corrida VaiCar (${formatBrl(offer.fareAmount)})",
                        message = "Embarque: ${offer.origin.address} → ${offer.destination.address}"
                    )
                }
            } catch (_: Exception) {
                // Retry next cycle
            }
            tracker.checkSignalFreshness()
            delay(3_000L)
        }
    }

    // Poll active ride state every 4s (detect passenger cancellation)
    LaunchedEffect(activeRide?.id) {
        val rideId = activeRide?.id ?: return@LaunchedEffect
        while (true) {
            runCatching {
                val latest = VaiCarApiClient.service.getRide(rideId).data
                if (latest != null) {
                    if (latest.status !in DRIVER_ACTIVE_STATUSES) {
                        if (latest.status == "CANCELLED_BY_PASSENGER") {
                            NotificationHelper.notifyRideEvent(
                                context = context,
                                id = rideId.hashCode(),
                                title = "Corrida cancelada pelo passageiro",
                                message = latest.cancelReason ?: "O passageiro cancelou esta solicitação."
                            )
                            bannerIsError = true
                            bannerMsg = "O passageiro cancelou a corrida."
                        }
                        activeRide = null
                        return@LaunchedEffect
                    } else {
                        activeRide = latest
                    }
                }
            }
            tracker.checkSignalFreshness()
            delay(4_000L)
        }
    }

    // 4-min waiting timer when ARRIVED
    LaunchedEffect(activeRide?.status, activeRide?.waitingTimerStartedAt, activeRide?.arrivedAt) {
        val ride = activeRide ?: return@LaunchedEffect
        if (ride.status != "ARRIVED") return@LaunchedEffect
        while (activeRide?.status == "ARRIVED") {
            waitingSec = computeWaitingRemainingSec(ride.waitingTimerStartedAt, ride.arrivedAt)
            delay(1_000L)
        }
    }

    // Load ride history on tab 1
    LaunchedEffect(selectedTab) {
        if (selectedTab == 1) {
            historyLoading = true
            runCatching {
                history = VaiCarApiClient.service.driverRides().data.orEmpty()
            }
            historyLoading = false
        }
    }

    Scaffold(
        containerColor = VaiCarColors.Background,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = VaiCarColors.Forest,
                    titleContentColor = VaiCarColors.White
                ),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("VaiCar Motorista", fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Spacer(Modifier.width(8.dp))
                        StatusPill(
                            text = if (isOnline) "ONLINE" else "OFFLINE",
                            background = if (isOnline) VaiCarColors.Mint else VaiCarColors.SurfaceVariant,
                            foreground = VaiCarColors.ForestDeep
                        )
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
                    label = { Text("Cockpit") }
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
                    val driverGeo = gpsState.sample?.let { GeoPoint(it.lat, it.lng) }
                    val mapMode = when (ride?.status) {
                        "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED" -> MapNavMode.DRIVER_TO_PICKUP
                        "IN_PROGRESS" -> MapNavMode.DRIVER_TO_DESTINATION
                        else -> MapNavMode.PLANNING
                    }

                    Column(modifier = Modifier.fillMaxSize()) {
                        // Interactive OSM Navigation Map
                        VaiCarOsmMap(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(0.47f),
                            mode = mapMode,
                            pickup = ride?.origin?.let { GeoPoint(it.lat, it.lng) }
                                ?: pendingOffer?.origin?.let { GeoPoint(it.lat, it.lng) },
                            pickupLabel = ride?.origin?.address ?: pendingOffer?.origin?.address ?: "Embarque",
                            destination = ride?.destination?.let { GeoPoint(it.lat, it.lng) }
                                ?: pendingOffer?.destination?.let { GeoPoint(it.lat, it.lng) },
                            destinationLabel = ride?.destination?.address ?: pendingOffer?.destination?.address ?: "Destino",
                            driverLocation = driverGeo,
                            driverAccuracyMeters = gpsState.sample?.accuracy,
                            driverStaleWarning = gpsState.status == GpsTrackerStatus.SIGNAL_LOST,
                            showExternalNavButtons = ride != null
                        )

                        // Bottom Cockpit Panel
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(0.53f),
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
                                // Approval Gate Banner
                                if (!isApproved) {
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = VaiCarColors.AmberSoft,
                                        border = BorderStroke(1.dp, VaiCarColors.Amber)
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Text(
                                                "Cadastro: ${currentDriver.status}",
                                                fontWeight = FontWeight.Black,
                                                color = VaiCarColors.Forest
                                            )
                                            Text(
                                                currentDriver.rejectionReason
                                                    ?: "Seu cadastro de motorista está aguardando aprovação da equipe VaiCar. Você poderá ficar online assim que aprovado.",
                                                fontSize = 12.sp,
                                                color = VaiCarColors.Graphite
                                            )
                                        }
                                    }
                                }

                                // GPS Permission / Signal Banner
                                if (!gpsState.hasPermission) {
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = VaiCarColors.RoseSoft,
                                        border = BorderStroke(1.dp, VaiCarColors.Rose)
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                "Permissão de GPS obrigatória para ficar online e navegar.",
                                                fontSize = 12.sp,
                                                color = VaiCarColors.Rose,
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
                                                colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Forest)
                                            ) {
                                                Text("Permitir", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                } else if (gpsState.errorMessage != null) {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = VaiCarColors.AmberSoft,
                                        border = BorderStroke(1.dp, VaiCarColors.Amber)
                                    ) {
                                        Text(
                                            gpsState.errorMessage!!,
                                            fontSize = 12.sp,
                                            color = VaiCarColors.Graphite,
                                            modifier = Modifier.padding(10.dp)
                                        )
                                    }
                                }

                                if (bannerMsg != null) {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = if (bannerIsError) VaiCarColors.RoseSoft else VaiCarColors.EmeraldSoft,
                                        border = BorderStroke(1.dp, if (bannerIsError) VaiCarColors.Rose else VaiCarColors.Emerald)
                                    ) {
                                        Text(
                                            bannerMsg!!,
                                            fontSize = 12.sp,
                                            color = if (bannerIsError) VaiCarColors.Rose else VaiCarColors.Forest,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(10.dp)
                                        )
                                    }
                                }

                                // Online / Offline Switch (when no active ride)
                                if (ride == null) {
                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = if (isOnline) VaiCarColors.EmeraldSoft else VaiCarColors.SurfaceVariant,
                                        border = BorderStroke(1.dp, if (isOnline) VaiCarColors.Emerald else VaiCarColors.Border)
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 14.dp, vertical = 10.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    Icons.Default.PowerSettingsNew,
                                                    contentDescription = null,
                                                    tint = if (isOnline) VaiCarColors.EmeraldDark else VaiCarColors.Muted
                                                )
                                                Spacer(Modifier.width(10.dp))
                                                Column {
                                                    Text(
                                                        if (isOnline) "Você está ONLINE" else "Você está OFFLINE",
                                                        fontWeight = FontWeight.Black,
                                                        color = VaiCarColors.Forest
                                                    )
                                                    val accText = gpsState.sample?.accuracy?.let { "GPS real ±${it.toInt()}m" }
                                                        ?: "Aguardando fixo de GPS real…"
                                                    Text(accText, fontSize = 11.sp, color = VaiCarColors.Muted)
                                                }
                                            }
                                            Switch(
                                                checked = isOnline,
                                                enabled = isApproved && !actionBusy && gpsState.hasPermission,
                                                onCheckedChange = { targetOnline ->
                                                    actionBusy = true
                                                    bannerMsg = null
                                                    scope.launch {
                                                        try {
                                                            val res = VaiCarApiClient.service.toggleOnline(ToggleOnlineRequest(targetOnline))
                                                            if (res.success && res.data != null) {
                                                                isOnline = res.data.isOnline
                                                                if (isOnline) tracker.start()
                                                            } else {
                                                                bannerIsError = true
                                                                bannerMsg = res.error?.message ?: "Não foi possível alterar o status."
                                                            }
                                                        } catch (ex: Exception) {
                                                            bannerIsError = true
                                                            bannerMsg = extractApiError(ex)
                                                        } finally {
                                                            actionBusy = false
                                                        }
                                                    }
                                                },
                                                colors = SwitchDefaults.colors(
                                                    checkedThumbColor = VaiCarColors.White,
                                                    checkedTrackColor = VaiCarColors.Emerald
                                                )
                                            )
                                        }
                                    }
                                }

                                // Post-ride payment confirmation & passenger rating
                                val doneRide = completedRideToFinalize
                                if (doneRide != null && ride == null) {
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
                                                "Corrida finalizada • ${formatBrl(doneRide.fareAmount)}",
                                                fontWeight = FontWeight.Black,
                                                color = VaiCarColors.Forest
                                            )
                                            if (doneRide.paymentApprovedByDriver != true) {
                                                Button(
                                                    enabled = !actionBusy,
                                                    onClick = {
                                                        actionBusy = true
                                                        scope.launch {
                                                            try {
                                                                val res = VaiCarApiClient.service.approvePayment(doneRide.id)
                                                                completedRideToFinalize = res.data?.ride ?: doneRide.copy(paymentApprovedByDriver = true)
                                                                bannerIsError = false
                                                                bannerMsg = "Pagamento confirmado com sucesso."
                                                            } catch (ex: Exception) {
                                                                bannerIsError = true
                                                                bannerMsg = extractApiError(ex)
                                                            } finally {
                                                                actionBusy = false
                                                            }
                                                        }
                                                    },
                                                    modifier = Modifier.fillMaxWidth(),
                                                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                                ) {
                                                    Text("Confirmar recebimento (${doneRide.paymentMethod})")
                                                }
                                            }
                                            Text("Avalie ${doneRide.passengerName}:", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                            StarRatingRow(rating = passengerStars, onRatingSelected = { passengerStars = it })
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                Button(
                                                    enabled = !actionBusy,
                                                    onClick = {
                                                        actionBusy = true
                                                        scope.launch {
                                                            runCatching {
                                                                VaiCarApiClient.service.ratePassenger(
                                                                    doneRide.id,
                                                                    RateRideRequest(rating = passengerStars)
                                                                )
                                                            }
                                                            completedRideToFinalize = null
                                                            actionBusy = false
                                                            bannerIsError = false
                                                            bannerMsg = "Avaliação do passageiro registrada."
                                                        }
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Forest)
                                                ) {
                                                    Text("Enviar avaliação")
                                                }
                                                OutlinedButton(onClick = { completedRideToFinalize = null }) {
                                                    Text("Fechar")
                                                }
                                            }
                                        }
                                    }
                                }

                                // Incoming Offer Card
                                val offer = pendingOffer
                                if (offer != null && ride == null) {
                                    Surface(
                                        shape = RoundedCornerShape(18.dp),
                                        color = VaiCarColors.EmeraldSoft,
                                        border = BorderStroke(2.dp, VaiCarColors.Emerald)
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(14.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text("NOVA CORRIDA", fontWeight = FontWeight.Black, color = VaiCarColors.EmeraldDark)
                                                Text(formatBrl(offer.fareAmount), fontSize = 20.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                                            }
                                            Text("Passageiro: ${offer.passengerName}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            Text("Embarque: ${offer.origin.address}", fontSize = 12.sp)
                                            Text("Destino: ${offer.destination.address}", fontSize = 12.sp)
                                            Text(
                                                "${"%.1f".format(offer.distanceKm)} km • Expira em ${offer.secondsRemaining ?: 25}s",
                                                fontSize = 11.sp,
                                                color = VaiCarColors.Muted
                                            )
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                                            ) {
                                                OutlinedButton(
                                                    enabled = !actionBusy,
                                                    onClick = {
                                                        actionBusy = true
                                                        scope.launch {
                                                            runCatching { VaiCarApiClient.service.declineOffer(offer.id) }
                                                            pendingOffer = null
                                                            actionBusy = false
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1f),
                                                    border = BorderStroke(1.dp, VaiCarColors.Rose)
                                                ) {
                                                    Text("Recusar", color = VaiCarColors.Rose, fontWeight = FontWeight.Bold)
                                                }
                                                Button(
                                                    enabled = !actionBusy,
                                                    onClick = {
                                                        actionBusy = true
                                                        bannerMsg = null
                                                        scope.launch {
                                                            try {
                                                                val res = VaiCarApiClient.service.acceptOffer(offer.id)
                                                                if (res.success && res.data != null) {
                                                                    activeRide = res.data
                                                                    pendingOffer = null
                                                                } else {
                                                                    bannerIsError = true
                                                                    bannerMsg = res.error?.message ?: "Oferta indisponível."
                                                                    pendingOffer = null
                                                                }
                                                            } catch (ex: Exception) {
                                                                bannerIsError = true
                                                                bannerMsg = extractApiError(ex)
                                                                pendingOffer = null
                                                            } finally {
                                                                actionBusy = false
                                                            }
                                                        }
                                                    },
                                                    modifier = Modifier.weight(1.4f),
                                                    colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                                ) {
                                                    Text("Aceitar Corrida", fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }

                                // ACTIVE RIDE NAVIGATION CONTROLS
                                if (ride != null) {
                                    val (bg, fg) = rideStatusColors(ride.status)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        StatusPill(rideStatusLabel(ride.status), bg, fg)
                                        Text(formatBrl(ride.fareAmount), fontSize = 18.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                                    }

                                    Text("Passageiro: ${ride.passengerName} (${ride.passengerPhone})", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = VaiCarColors.Forest)
                                    Text("Embarque: ${ride.origin.address}", fontSize = 12.sp)
                                    Text("Destino: ${ride.destination.address}", fontSize = 12.sp)
                                    Text("Pagamento: ${ride.paymentMethod}", fontSize = 12.sp, color = VaiCarColors.Muted)

                                    if (ride.status == "ARRIVED") {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = VaiCarColors.EmeraldSoft
                                        ) {
                                            Text(
                                                "Aguardando passageiro no embarque • ${formatCountdown(waitingSec)}",
                                                color = VaiCarColors.Forest,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(10.dp)
                                            )
                                        }
                                    }

                                    when (ride.status) {
                                        "ACCEPTED", "DRIVER_ARRIVING" -> {
                                            Button(
                                                enabled = !actionBusy,
                                                onClick = {
                                                    actionBusy = true
                                                    scope.launch {
                                                        try {
                                                            val res = VaiCarApiClient.service.markArrived(ride.id)
                                                            if (res.success && res.data != null) activeRide = res.data
                                                        } catch (ex: Exception) {
                                                            bannerIsError = true
                                                            bannerMsg = extractApiError(ex)
                                                        } finally {
                                                            actionBusy = false
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth().height(50.dp),
                                                shape = RoundedCornerShape(14.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                            ) {
                                                Text("Cheguei no Embarque", fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        "ARRIVED" -> {
                                            Button(
                                                enabled = !actionBusy,
                                                onClick = {
                                                    actionBusy = true
                                                    scope.launch {
                                                        try {
                                                            val res = VaiCarApiClient.service.startRide(ride.id)
                                                            if (res.success && res.data != null) activeRide = res.data
                                                        } catch (ex: Exception) {
                                                            bannerIsError = true
                                                            bannerMsg = extractApiError(ex)
                                                        } finally {
                                                            actionBusy = false
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth().height(50.dp),
                                                shape = RoundedCornerShape(14.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Forest)
                                            ) {
                                                Text("Iniciar Viagem", fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        "IN_PROGRESS" -> {
                                            Button(
                                                enabled = !actionBusy,
                                                onClick = {
                                                    actionBusy = true
                                                    scope.launch {
                                                        try {
                                                            val res = VaiCarApiClient.service.completeRide(
                                                                ride.id,
                                                                CompleteRideRequest(paymentApproved = false)
                                                            )
                                                            val finished = res.data?.ride ?: ride.copy(status = "COMPLETED")
                                                            activeRide = null
                                                            completedRideToFinalize = finished
                                                        } catch (ex: Exception) {
                                                            bannerIsError = true
                                                            bannerMsg = extractApiError(ex)
                                                        } finally {
                                                            actionBusy = false
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth().height(50.dp),
                                                shape = RoundedCornerShape(14.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = VaiCarColors.Emerald)
                                            ) {
                                                Text("Finalizar Viagem", fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }

                                    if (ride.status in setOf("ACCEPTED", "DRIVER_ARRIVING", "ARRIVED")) {
                                        OutlinedButton(
                                            enabled = !actionBusy,
                                            onClick = {
                                                actionBusy = true
                                                scope.launch {
                                                    try {
                                                        VaiCarApiClient.service.cancelRide(
                                                            ride.id,
                                                            CancelRideRequest(reason = "Cancelado pelo motorista no app")
                                                        )
                                                        activeRide = null
                                                        bannerIsError = false
                                                        bannerMsg = "Corrida cancelada."
                                                    } catch (ex: Exception) {
                                                        bannerIsError = true
                                                        bannerMsg = extractApiError(ex)
                                                    } finally {
                                                        actionBusy = false
                                                    }
                                                }
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            border = BorderStroke(1.dp, VaiCarColors.Rose)
                                        ) {
                                            Text("Cancelar corrida", color = VaiCarColors.Rose)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // DRIVER RIDE HISTORY TAB
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
                            Text("Corridas realizadas", fontSize = 18.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                            IconButton(onClick = {
                                scope.launch {
                                    historyLoading = true
                                    runCatching { history = VaiCarApiClient.service.driverRides().data.orEmpty() }
                                    historyLoading = false
                                }
                            }) {
                                Icon(Icons.Default.Refresh, contentDescription = "Atualizar", tint = VaiCarColors.Forest)
                            }
                        }

                        if (historyLoading) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = VaiCarColors.Forest)
                            }
                        } else if (history.isEmpty()) {
                            Text("Nenhuma corrida registrada ainda.", color = VaiCarColors.Muted, fontSize = 13.sp)
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
                                            Text("Passageiro: ${item.passengerName}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                            Text("De: ${item.origin.address}", fontSize = 12.sp)
                                            Text("Para: ${item.destination.address}", fontSize = 12.sp)
                                            if (item.status == "COMPLETED" && item.paymentApprovedByDriver != true) {
                                                OutlinedButton(
                                                    onClick = {
                                                        scope.launch {
                                                            runCatching { VaiCarApiClient.service.approvePayment(item.id) }
                                                            runCatching { history = VaiCarApiClient.service.driverRides().data.orEmpty() }
                                                        }
                                                    },
                                                    border = BorderStroke(1.dp, VaiCarColors.Emerald)
                                                ) {
                                                    Text("Confirmar pagamento (${item.paymentMethod})", color = VaiCarColors.EmeraldDark)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                2 -> {
                    // DRIVER PROFILE & GPS DIAGNOSTICS TAB
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Perfil do Motorista", fontSize = 20.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            color = VaiCarColors.White,
                            border = BorderStroke(1.dp, VaiCarColors.Border)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(currentDriver.name, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                                Text(currentDriver.email, fontSize = 13.sp, color = VaiCarColors.Muted)
                                StatusPill(
                                    text = "Status: ${currentDriver.status}",
                                    background = if (isApproved) VaiCarColors.EmeraldSoft else VaiCarColors.AmberSoft,
                                    foreground = if (isApproved) VaiCarColors.EmeraldDark else VaiCarColors.Amber
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Nota: ★ ${"%.1f".format(currentDriver.rating)}", fontWeight = FontWeight.Bold)
                                    Text("Corridas: ${currentDriver.completedRidesCount}", fontWeight = FontWeight.Bold)
                                }

                                HorizontalDivider(color = VaiCarColors.SurfaceVariant)

                                currentDriver.vehicle?.let { veh ->
                                    Text("Veículo cadastrado", fontWeight = FontWeight.Bold, color = VaiCarColors.Forest, fontSize = 13.sp)
                                    Text("${veh.brand} ${veh.model} (${veh.year}) • ${veh.color}", fontSize = 13.sp)
                                    Text("Placa: ${veh.plate}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }

                                if (currentDriver.operatingZones.isNotEmpty()) {
                                    Text("Zonas: ${currentDriver.operatingZones.joinToString(", ")}", fontSize = 12.sp, color = VaiCarColors.Muted)
                                }

                                HorizontalDivider(color = VaiCarColors.SurfaceVariant)

                                Text("Diagnóstico GPS Real", fontWeight = FontWeight.Bold, color = VaiCarColors.Forest, fontSize = 13.sp)
                                val sample = gpsState.sample
                                Text(
                                    if (sample != null) {
                                        "Lat ${"%.5f".format(sample.lat)}, Lng ${"%.5f".format(sample.lng)} • Precisão ±${sample.accuracy?.toInt() ?: 0}m"
                                    } else {
                                        "Status: ${gpsState.status} (nenhuma coordenada fictícia usada)"
                                    },
                                    fontSize = 12.sp,
                                    color = VaiCarColors.Graphite
                                )
                            }
                        }

                        OutlinedButton(
                            onClick = {
                                tracker.stop()
                                VaiCarSession.clear(context)
                                profile = null
                                driver = null
                                activeRide = null
                                pendingOffer = null
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
