package app.vaicar.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.vaicar.BuildConfig
import app.vaicar.data.ForgotPasswordRequest
import app.vaicar.data.LoginRequest
import app.vaicar.data.ProfilePayload
import app.vaicar.data.ResetPasswordRequest
import app.vaicar.data.VaiCarApiClient
import app.vaicar.data.VaiCarSession
import app.vaicar.ui.theme.VaiCarColors
import com.google.gson.JsonParser
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.time.Instant
import java.util.Locale
import kotlin.math.max

fun formatBrl(amount: Double): String =
    String.format(Locale("pt", "BR"), "R$ %.2f", amount)

fun extractApiError(error: Throwable): String {
    if (error is HttpException) {
        val raw = runCatching { error.response()?.errorBody()?.string() }.getOrNull()
        if (!raw.isNullOrBlank()) {
            val parsed = runCatching {
                val obj = JsonParser.parseString(raw).asJsonObject
                obj.getAsJsonObject("error")?.get("message")?.asString
                    ?: obj.get("message")?.asString
            }.getOrNull()
            if (!parsed.isNullOrBlank()) return parsed
        }
        return when (error.code()) {
            401 -> "Sessão expirada ou credenciais incorretas."
            403 -> "Acesso não autorizado para este perfil."
            404 -> "Recurso não encontrado."
            429 -> "Muitas tentativas. Aguarde alguns segundos."
            else -> "Erro do servidor (${error.code()})."
        }
    }
    return error.message?.takeIf { it.isNotBlank() } ?: "Falha de conexão. Verifique sua internet."
}

fun rideStatusLabel(status: String): String = when (status) {
    "REQUESTED", "OFFERING" -> "Procurando motorista"
    "ACCEPTED", "DRIVER_ARRIVING" -> "Motorista a caminho"
    "ARRIVED" -> "Motorista no local"
    "IN_PROGRESS" -> "Em viagem"
    "COMPLETED" -> "Finalizada"
    "CANCELLED_BY_PASSENGER" -> "Cancelada pelo passageiro"
    "CANCELLED_BY_DRIVER" -> "Cancelada pelo motorista"
    "NO_DRIVER_AVAILABLE" -> "Sem motorista disponível"
    else -> status
}

fun rideStatusColors(status: String): Pair<Color, Color> = when (status) {
    "REQUESTED", "OFFERING" -> VaiCarColors.AmberSoft to VaiCarColors.Amber
    "ACCEPTED", "DRIVER_ARRIVING" -> VaiCarColors.RouteCyanSoft to VaiCarColors.RouteCyan
    "ARRIVED", "IN_PROGRESS", "COMPLETED" -> VaiCarColors.EmeraldSoft to VaiCarColors.EmeraldDark
    else -> VaiCarColors.RoseSoft to VaiCarColors.Rose
}

fun computeWaitingRemainingSec(waitingTimerStartedAt: String?, arrivedAt: String?, nowMs: Long = System.currentTimeMillis()): Int {
    val iso = waitingTimerStartedAt ?: arrivedAt ?: return 240
    val startMs = runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull() ?: return 240
    val elapsedSec = ((nowMs - startMs) / 1000L).toInt().coerceAtLeast(0)
    return max(0, 240 - elapsedSec)
}

fun formatCountdown(seconds: Int): String {
    val mins = seconds / 60
    val secs = seconds % 60
    return String.format(Locale.US, "%02d:%02d", mins, secs)
}

fun openPortalUrl(context: Context, path: String) {
    val base = BuildConfig.API_BASE_URL.trimEnd('/')
    val uri = Uri.parse("$base/${path.trimStart('/')}")
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

@Composable
fun StatusPill(text: String, background: Color, foreground: Color, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color = background
    ) {
        Text(
            text = text,
            color = foreground,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun StarRatingRow(
    rating: Int,
    onRatingSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (star in 1..5) {
            Icon(
                imageVector = if (star <= rating) Icons.Filled.Star else Icons.Outlined.StarBorder,
                contentDescription = "$star estrelas",
                tint = if (star <= rating) VaiCarColors.Amber else VaiCarColors.Muted,
                modifier = Modifier
                    .size(34.dp)
                    .clickable { onRatingSelected(star) }
            )
        }
    }
}

@Composable
fun VaiCarAuthCard(
    appTitle: String,
    subtitle: String,
    registerPath: String,
    registerButtonLabel: String,
    accentColor: Color,
    onAuthenticated: (ProfilePayload) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var forgotMode by rememberSaveable { mutableStateOf(false) }
    var pinSent by rememberSaveable { mutableStateOf(false) }
    var pin by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Brand Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
                shape = CircleShape,
                color = accentColor,
                modifier = Modifier.size(48.dp)
            ) {
                Column(
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("V", color = VaiCarColors.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(appTitle, fontSize = 22.sp, fontWeight = FontWeight.Black, color = VaiCarColors.Forest)
                Text(subtitle, fontSize = 12.sp, color = VaiCarColors.Muted)
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = VaiCarColors.White,
            shadowElevation = 4.dp,
            border = BorderStroke(1.dp, VaiCarColors.Border)
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (!forgotMode) {
                    Text("Entrar na sua conta", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; feedback = null },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        label = { Text("E-mail") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; feedback = null },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        label = { Text("Senha") },
                        visualTransformation = PasswordVisualTransformation()
                    )

                    if (feedback != null) {
                        Text(
                            text = feedback!!,
                            color = if (isError) VaiCarColors.Rose else VaiCarColors.EmeraldDark,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Button(
                        enabled = !busy && email.isNotBlank() && password.length >= 4,
                        onClick = {
                            busy = true
                            feedback = null
                            isError = false
                            scope.launch {
                                try {
                                    val loginRes = VaiCarApiClient.service.login(
                                        LoginRequest(email.trim().lowercase(), password)
                                    )
                                    if (!loginRes.success || loginRes.token.isNullOrBlank()) {
                                        isError = true
                                        feedback = loginRes.error?.message ?: loginRes.message ?: "Credenciais inválidas."
                                    } else {
                                        VaiCarSession.save(
                                            context = context,
                                            token = loginRes.token,
                                            email = loginRes.user?.email ?: email.trim().lowercase(),
                                            displayName = loginRes.user?.displayName,
                                            role = loginRes.user?.role ?: loginRes.roles.firstOrNull()
                                        )
                                        val meRes = VaiCarApiClient.service.me()
                                        val profile = meRes.data ?: ProfilePayload(
                                            user = loginRes.user,
                                            passenger = loginRes.passenger,
                                            driver = loginRes.driver,
                                            isAdmin = loginRes.isAdmin
                                        )
                                        onAuthenticated(profile)
                                    }
                                } catch (ex: Exception) {
                                    isError = true
                                    feedback = extractApiError(ex)
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                    ) {
                        Text(if (busy) "Autenticando…" else "Entrar", fontWeight = FontWeight.Bold)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = { forgotMode = true; feedback = null }) {
                            Text("Esqueci minha senha", color = VaiCarColors.Forest, fontSize = 12.sp)
                        }
                    }

                    OutlinedButton(
                        onClick = { openPortalUrl(context, registerPath) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, VaiCarColors.Emerald)
                    ) {
                        Text(registerButtonLabel, color = VaiCarColors.Forest, fontWeight = FontWeight.SemiBold)
                    }
                } else {
                    Text("Recuperar senha", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = VaiCarColors.Forest)
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        label = { Text("E-mail cadastrado") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                    )

                    if (pinSent) {
                        OutlinedTextField(
                            value = pin,
                            onValueChange = { pin = it.filter { ch -> ch.isDigit() }.take(6) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            label = { Text("Código PIN (6 dígitos)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        OutlinedTextField(
                            value = newPassword,
                            onValueChange = { newPassword = it },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            label = { Text("Nova senha (mín. 6 caracteres)") },
                            visualTransformation = PasswordVisualTransformation()
                        )
                    }

                    if (feedback != null) {
                        Text(
                            text = feedback!!,
                            color = if (isError) VaiCarColors.Rose else VaiCarColors.EmeraldDark,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    if (!pinSent) {
                        Button(
                            enabled = !busy && email.contains("@"),
                            onClick = {
                                busy = true
                                feedback = null
                                isError = false
                                scope.launch {
                                    try {
                                        VaiCarApiClient.service.forgotPassword(ForgotPasswordRequest(email.trim().lowercase()))
                                        pinSent = true
                                        feedback = "Se o e-mail estiver cadastrado, enviamos um PIN de 6 dígitos."
                                    } catch (ex: Exception) {
                                        isError = true
                                        feedback = extractApiError(ex)
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                        ) {
                            Text(if (busy) "Enviando…" else "Enviar código PIN")
                        }
                    } else {
                        Button(
                            enabled = !busy && pin.length == 6 && newPassword.length >= 6,
                            onClick = {
                                busy = true
                                feedback = null
                                isError = false
                                scope.launch {
                                    try {
                                        val res = VaiCarApiClient.service.resetPassword(
                                            ResetPasswordRequest(email.trim().lowercase(), pin, newPassword)
                                        )
                                        if (res.success) {
                                            forgotMode = false
                                            pinSent = false
                                            password = newPassword
                                            feedback = "Senha redefinida! Faça login agora."
                                            isError = false
                                        } else {
                                            isError = true
                                            feedback = res.message ?: "Não foi possível redefinir a senha."
                                        }
                                    } catch (ex: Exception) {
                                        isError = true
                                        feedback = extractApiError(ex)
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                        ) {
                            Text(if (busy) "Salvando…" else "Redefinir senha")
                        }
                    }

                    TextButton(onClick = { forgotMode = false; pinSent = false; feedback = null }) {
                        Text("Voltar para o login", color = VaiCarColors.Muted)
                    }
                }
            }
        }
        Text(
            text = "São Sebastião • Litoral Norte de São Paulo • Backend unificado VaiCar",
            fontSize = 11.sp,
            color = VaiCarColors.Muted
        )
    }
}
