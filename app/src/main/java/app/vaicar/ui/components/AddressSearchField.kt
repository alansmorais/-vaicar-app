package app.vaicar.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.vaicar.data.LocationPointDto
import app.vaicar.data.PlacePredictionDto
import app.vaicar.data.RouteRepository
import app.vaicar.geo.GeoNavigationEngine
import app.vaicar.ui.theme.VaiCarColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Free-text São Sebastião address search field with debounced autocomplete.
 *
 * - Zero predefined destination lists.
 * - Rejects out-of-operational-area points with a clear Portuguese message.
 * - Never invents coordinates when an address is not found.
 */
@Composable
fun AddressSearchField(
    label: String,
    placeholder: String,
    value: String,
    confirmedPoint: LocationPointDto?,
    onTextChange: (String) -> Unit,
    onPointSelected: (LocationPointDto) -> Unit,
    onClear: () -> Unit,
    onUseGpsClick: (() -> Unit)? = null,
    gpsAvailable: Boolean = false,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var suggestions by remember { mutableStateOf<List<PlacePredictionDto>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }
    var dropdownOpen by remember { mutableStateOf(false) }

    LaunchedEffect(value, confirmedPoint) {
        val trimmed = value.trim()
        if (confirmedPoint != null && confirmedPoint.address == value) {
            suggestions = emptyList()
            dropdownOpen = false
            return@LaunchedEffect
        }
        if (trimmed.length < 3) {
            suggestions = emptyList()
            dropdownOpen = false
            return@LaunchedEffect
        }
        delay(350L)
        searching = true
        validationError = null
        try {
            val found = RouteRepository.searchAddresses(trimmed)
            suggestions = found
            dropdownOpen = found.isNotEmpty()
            if (found.isEmpty()) {
                validationError = "Nenhum endereço encontrado em São Sebastião para \"$trimmed\"."
            }
        } catch (_: Exception) {
            suggestions = emptyList()
            dropdownOpen = false
        } finally {
            searching = false
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = { next ->
                validationError = null
                onTextChange(next)
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            label = { Text(label, fontSize = 13.sp) },
            placeholder = { Text(placeholder, fontSize = 13.sp, color = VaiCarColors.Muted) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = VaiCarColors.Emerald,
                unfocusedBorderColor = VaiCarColors.Border,
                focusedContainerColor = VaiCarColors.White,
                unfocusedContainerColor = VaiCarColors.White
            ),
            leadingIcon = {
                Icon(
                    imageVector = if (confirmedPoint != null) Icons.Default.CheckCircle else Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = if (confirmedPoint != null) VaiCarColors.Emerald else VaiCarColors.Muted,
                    modifier = Modifier.size(20.dp)
                )
            },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (searching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = VaiCarColors.Emerald
                        )
                        Spacer(Modifier.width(6.dp))
                    }
                    if (onUseGpsClick != null && gpsAvailable) {
                        IconButton(onClick = {
                            validationError = null
                            dropdownOpen = false
                            onUseGpsClick()
                        }) {
                            Icon(
                                Icons.Default.MyLocation,
                                contentDescription = "Usar GPS atual",
                                tint = VaiCarColors.Emerald,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    if (value.isNotEmpty()) {
                        IconButton(onClick = {
                            validationError = null
                            suggestions = emptyList()
                            dropdownOpen = false
                            onClear()
                        }) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Limpar endereço",
                                tint = VaiCarColors.Muted,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        )

        if (validationError != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = validationError!!,
                color = VaiCarColors.Rose,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }

        if (dropdownOpen && suggestions.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = VaiCarColors.White,
                shadowElevation = 4.dp,
                border = BorderStroke(1.dp, VaiCarColors.Border)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    suggestions.forEachIndexed { idx, item ->
                        val outOfArea = item.inOperationalArea == false
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    scope.launch {
                                        val lat = item.lat
                                        val lng = item.lng
                                        val resolved = if (lat != null && lng != null) {
                                            LocationPointDto(item.description, lat, lng)
                                        } else {
                                            searching = true
                                            val geo = RouteRepository.geocodeAddress(item.description)
                                            searching = false
                                            if (geo != null) {
                                                LocationPointDto(geo.address.ifBlank { item.description }, geo.lat, geo.lng)
                                            } else {
                                                null
                                            }
                                        }

                                        if (resolved == null) {
                                            validationError = "Não foi possível confirmar as coordenadas deste endereço."
                                            return@launch
                                        }

                                        val check = GeoNavigationEngine.validateOperationalPoint(
                                            resolved.lat,
                                            resolved.lng,
                                            label
                                        )
                                        if (!check.valid) {
                                            validationError = check.message
                                            return@launch
                                        }

                                        validationError = null
                                        dropdownOpen = false
                                        suggestions = emptyList()
                                        onPointSelected(resolved)
                                    }
                                }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.mainText?.takeIf { it.isNotBlank() } ?: item.description,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (outOfArea) VaiCarColors.Muted else VaiCarColors.Graphite
                                )
                                val sub = item.secondaryText?.takeIf { it.isNotBlank() }
                                if (sub != null) {
                                    Text(
                                        text = sub,
                                        fontSize = 11.sp,
                                        color = VaiCarColors.Muted
                                    )
                                }
                            }
                            if (outOfArea) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = VaiCarColors.RoseSoft
                                ) {
                                    Text(
                                        text = "Fora da área",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = VaiCarColors.Rose,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                        if (idx < suggestions.lastIndex) {
                            HorizontalDivider(color = VaiCarColors.SurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}
