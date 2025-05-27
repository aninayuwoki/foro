// Definición de pines
const int ledPin = LED_BUILTIN;  // LED incorporado
const int buzzerPin = 9;         // Pin para el zumbador (puedes cambiarlo según tu configuración)

// Duración total del temporizador en milisegundos
const long timerDuration = 10000; // 10 segundos = 10000 milisegundos

// Variables para el control del tiempo
long startTime;                 // Almacena el tiempo cuando se inició el contador
bool exploded = false;          // Bandera para saber si la "bomba" ya explotó
bool ledState = false;          // Estado del LED (encendido/apagado)

// Variables para comunicación con Python
unsigned long lastCommandTime = 0;  // Último tiempo en que se envió un comando
const int minCommandInterval = 10;  // Intervalo mínimo entre comandos (ms)

// Variable para indicar que se necesita una nueva pregunta
bool needNewQuestion = true;    // Bandera para solicitar nueva pregunta

void setup() {
  // Configura el pin del LED como una salida
  pinMode(ledPin, OUTPUT);
  // Configura el pin del zumbador como una salida
  pinMode(buzzerPin, OUTPUT);
  
  // Inicia la comunicación serial para depuración y comunicación con Python
  Serial.begin(9600);
  Serial.println("--- Bomba lista. Tienes 10 segundos para desactivarla ---");
  Serial.println("Responde correctamente a las preguntas para reiniciar el contador.");
  
  // Llama a la función para iniciar el temporizador
  resetTimer();
}

void loop() {
  // Verificar si hay datos entrantes desde Python
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    // Si recibimos "RESPUESTA_CORRECTA", reiniciamos el contador
    if (input == "RESPUESTA_CORRECTA") {
      resetTimer();
    }
  }
  
  // Solo ejecuta el código del temporizador si la bomba no ha explotado aún
  if (!exploded) {
    long currentTime = millis();          // Obtiene el tiempo actual desde que el Arduino se encendió
    long elapsedTime = currentTime - startTime; // Calcula el tiempo transcurrido
    
    // Calcula la duración del parpadeo
    long blinkDelay = map(elapsedTime, 0, timerDuration, 500, 10);
    // Asegurarse que el delay no sea 0 o negativo
    blinkDelay = constrain(blinkDelay, 10, 500);
    
    // Si se necesita una nueva pregunta, solicitarla
    if (needNewQuestion) {
      Serial.println("NUEVA_PREGUNTA");
      needNewQuestion = false;
    }
    
    // Si el tiempo ha terminado, la bomba "explota"
    if (elapsedTime >= timerDuration) {
      Serial.println("!!! BOOM !!! - Tiempo agotado. La bomba exploto.");
      // Envía la señal de explosión al programa Python
      Serial.println("EXPLOSION");
      
      digitalWrite(ledPin, HIGH); // El LED se queda encendido fijo para indicar la explosión
      tone(buzzerPin, 1000, 2000); // Tono continuo de alarma final
      exploded = true;            // Marca la bomba como explotada
    } else {
      // Cambia el estado del LED
      ledState = !ledState;
      digitalWrite(ledPin, ledState);
      
      // Sincronizamos el zumbador con el LED
      if (ledState) {
        // Cuando el LED se enciende, también emitimos un pitido
        // La frecuencia aumenta conforme el tiempo avanza
        int toneFrequency = map(elapsedTime, 0, timerDuration, 500, 2000);
        tone(buzzerPin, toneFrequency);
        
        // Enviamos el comando BIP a Python
        Serial.print("BIP:");
        Serial.println(toneFrequency);
      } else {
        // Cuando el LED se apaga, también silenciamos el zumbador
        noTone(buzzerPin);
        
        // Enviamos el comando STOP a Python
        Serial.println("STOP");
      }
      
      // Imprime el tiempo restante en el Monitor Serial
      // Sólo enviamos la actualización de tiempo cada 250ms para no sobrecargar
      if (currentTime - lastCommandTime >= 250) {
        Serial.print("TIEMPO:");
        Serial.println((timerDuration - elapsedTime) / 1000.0); // Convierte a segundos
        lastCommandTime = currentTime;
      }
      
      delay(blinkDelay / 2); // Espera la mitad del tiempo de parpadeo
    }
  }
}

// Función para reiniciar el temporizador
void resetTimer() {
  startTime = millis();           // Guarda el tiempo actual como el inicio del contador
  exploded = false;               // Reinicia la bandera de explosión
  digitalWrite(ledPin, LOW);      // Asegura que el LED esté apagado al reiniciar
  noTone(buzzerPin);              // Silencia el zumbador al reiniciar
  ledState = false;
  needNewQuestion = true;         // Solicitar una nueva pregunta
  
  // Enviamos señal de reinicio a Python
  Serial.println("RESET");
  
  Serial.println("\n--- Contador reiniciado. Nuevos 10 segundos! ---");
}