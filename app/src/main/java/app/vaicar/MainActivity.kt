package app.vaicar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.rememberCoroutineScope
import app.vaicar.data.LoginRequest
import app.vaicar.data.VaiCarApiClient
import app.vaicar.data.VaiCarSession
import kotlinx.coroutines.launch

private val Forest = Color(0xFF087A4B)
private val DeepForest = Color(0xFF052B20)
private val Ink = Color(0xFF071B16)
private val Mint = Color(0xFFB7F7D5)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { VaiCarApp() }
    }
}

@Composable
private fun VaiCarApp() {
    var selectedMode by rememberSaveable { mutableStateOf("passenger") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var signedInName by rememberSaveable { mutableStateOf<String?>(null) }
    var signedInRole by rememberSaveable { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("Conectando ao servidor VaiCar…") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    MaterialTheme(colorScheme = darkColorScheme(
        primary = Forest, secondary = Mint, background = Ink, surface = DeepForest,
        onPrimary = Color.White, onBackground = Color.White, onSurface = Color.White
    )) {
        Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
            Column(
                modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.Center
            ) {
                Surface(shape = CircleShape, color = Forest) {
                    Text("V", modifier = Modifier.padding(horizontal = 23.dp, vertical = 13.dp),
                        color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.height(18.dp))
                Text("VAI", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Black)
                Text("CAR", color = Mint, fontSize = 40.sp, fontWeight = FontWeight.Black)
                Text("São Sebastião, nossa casa ♡", color = Mint, fontSize = 14.sp)
                Spacer(Modifier.height(28.dp))

                if (signedInName == null) {
                    Text("Entre na sua conta", fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(14.dp))
                    ModeCard("Passageiro", "Solicite viagens e acompanhe seu motorista.",
                        selectedMode == "passenger") { selectedMode = "passenger" }
                    Spacer(Modifier.height(10.dp))
                    ModeCard("Motorista / Entregador", "Acesse sua área de parceiro.",
                        selectedMode == "driver") { selectedMode = "driver" }
                    Spacer(Modifier.height(18.dp))
                    OutlinedTextField(
                        value = email, onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth(), singleLine = true,
                        label = { Text("E-mail") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = password, onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(), singleLine = true,
                        label = { Text("Senha") },
                        visualTransformation = PasswordVisualTransformation()
                    )
                    Spacer(Modifier.height(18.dp))
                    Button(
                        enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                        onClick = {
                            busy = true
                            status = "Autenticando com o servidor seguro…"
                            scope.launch {
                                try {
                                    val result = VaiCarApiClient.service.login(LoginRequest(email.trim(), password))
                                    if (!result.success || result.token.isNullOrBlank()) {
                                        status = result.message ?: "Não foi possível autenticar."
                                    } else {
                                        VaiCarSession.token = result.token
                                        val profile = VaiCarApiClient.service.me().data
                                        signedInName = profile?.user?.displayName
                                            ?: result.user?.displayName
                                            ?: result.user?.email
                                            ?: email
                                        signedInRole = profile?.user?.role
                                            ?: result.user?.role
                                            ?: result.roles.firstOrNull()
                                        status = "Sessão segura conectada. Perfil: ${signedInRole ?: selectedMode}."
                                    }
                                } catch (error: Exception) {
                                    status = error.message ?: "Falha de conexão. Tente novamente."
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Forest)
                    ) { Text(if (busy) "Aguarde…" else "Entrar") }
                } else {
                    Text("Olá, $signedInName", fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Text("Perfil: ${signedInRole ?: selectedMode}", color = Mint)
                    Spacer(Modifier.height(12.dp))
                    Text("Sua sessão foi autenticada pelo backend VaiCar.", color = Color(0xFFB5C9BF))
                    Spacer(Modifier.height(20.dp))
                    Button(onClick = {
                        VaiCarSession.token = null
                        signedInName = null
                        signedInRole = null
                        password = ""
                        status = "Você saiu da conta."
                    }, modifier = Modifier.fillMaxWidth()) { Text("Sair") }
                }
                Spacer(Modifier.height(18.dp))
                Text(status, color = Color(0xFFB7F7D5), fontSize = 12.sp)
                Text("Mobilidade local, feita para quem vive o Litoral Norte.",
                    color = Color(0xFF9CB7AA), fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ModeCard(title: String, subtitle: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick, modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = if (selected) Color(0xFF104C37) else DeepForest,
        border = BorderStroke(1.dp, if (selected) Mint else Color(0xFF25463A))
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(4.dp))
                Text(subtitle, color = Color(0xFFB5C9BF), fontSize = 12.sp)
            }
            Text(if (selected) "✓" else "›", color = Mint, fontSize = 24.sp)
        }
    }
}
