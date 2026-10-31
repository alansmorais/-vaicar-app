package app.vaicar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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
                Spacer(Modifier.height(24.dp))
                Text("VAI", color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.Black)
                Text("CAR", color = Mint, fontSize = 42.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(8.dp))
                Text("São Sebastião, nossa casa ♡", color = Mint, fontSize = 15.sp)
                Spacer(Modifier.height(36.dp))
                Text("Como você quer usar o VaiCar?", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))
                ModeCard("Quero me deslocar", "Encontre motoristas e acompanhe sua viagem.",
                    selectedMode == "passenger") { selectedMode = "passenger" }
                Spacer(Modifier.height(12.dp))
                ModeCard("Quero dirigir ou entregar", "Acesse sua área de motorista ou entregador.",
                    selectedMode == "driver") { selectedMode = "driver" }
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = { /* Native authentication and navigation are implemented in the next milestone. */ },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Forest)
                ) {
                    Text(if (selectedMode == "passenger") "Continuar como passageiro" else "Continuar como parceiro")
                }
                Spacer(Modifier.height(18.dp))
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
        Row(modifier = Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.height(4.dp))
                Text(subtitle, color = Color(0xFFB5C9BF), fontSize = 12.sp)
            }
            Text(if (selected) "✓" else "›", color = Mint, fontSize = 24.sp)
        }
    }
}
