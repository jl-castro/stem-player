package com.example.vitalis

import android.content.res.ColorStateList
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.vitalis.data.AppDatabase
import com.example.vitalis.data.CasosRoomRepository
import com.example.vitalis.data.ProgresoEntity
import com.example.vitalis.data.ProgresoRepository
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private var casos: List<Caso> = emptyList()
    private lateinit var casosRepository: CasosRoomRepository
    private lateinit var progresoRepository: ProgresoRepository
    private val dbExecutor = Executors.newSingleThreadExecutor()
    private var progresoDisponible = false

    private var puntos = 0
    private var casoActual = 0
    private var diagnosticosCorrectos = 0
    private var tratamientosCorrectos = 0
    private var segundosRestantes = GameLogic.TIEMPO_PRACTICANTE
    private var diagnosticoElegido: String? = null
    private var tratamientoElegido: String? = null
    private var diagnosticoCorrectoActual = false
    private var tratamientoCorrectoActual = false
    private var casoCerrado = false
    private var tiempoTotalCaso = GameLogic.TIEMPO_PRACTICANTE
    private var nivelInicioActual = 0
    private var evaluacionNivelInicio = 0
    private var evaluacionNivelAprobada = false
    private var checkpointNivel = GameLogic.crearCheckpoint(0, 0, 0)
    private var timer: CountDownTimer? = null

    private lateinit var tvRango: TextView
    private lateinit var tvTimer: TextView
    private lateinit var tvPuntos: TextView
    private lateinit var tvProgreso: TextView
    private lateinit var tvDificultad: TextView
    private lateinit var tvSiguienteRango: TextView
    private lateinit var tvPacienteNombre: TextView
    private lateinit var tvPacienteEdad: TextView
    private lateinit var tvSintomas: TextView
    private lateinit var tvFeedbackDiagnostico: TextView
    private lateinit var ivPaciente: ImageView
    private lateinit var tvDatos: TextView
    private lateinit var tvFeedback: TextView
    private lateinit var tvResultadoFinal: TextView
    private lateinit var tvResultadoRango: TextView
    private lateinit var tvComoJugar: TextView
    private lateinit var tvNivelCompletado: TextView
    private lateinit var tvNuevoNivel: TextView
    private lateinit var tvEvaluacionNivel: TextView
    private lateinit var progressPartida: ProgressBar
    private lateinit var progressRango: ProgressBar
    private lateinit var progressTimer: ProgressBar
    private lateinit var progressNivel: ProgressBar
    private lateinit var progressEvaluacionNivel: ProgressBar
    private lateinit var tvObjetivoNivel: TextView
    private lateinit var layoutInicio: LinearLayout
    private lateinit var layoutJuego: LinearLayout
    private lateinit var layoutTrat: LinearLayout
    private lateinit var layoutResultado: LinearLayout
    private lateinit var layoutNivel: LinearLayout
    private lateinit var btnJugar: Button
    private lateinit var btnComoJugar: Button
    private lateinit var btnNuevaPartida: Button
    private lateinit var btnSiguiente: Button
    private lateinit var btnJugarDeNuevo: Button
    private lateinit var btnContinuarNivel: Button
    private lateinit var btnDiag: List<Button>
    private lateinit var btnTrat: List<Button>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        enlazarVistas()
        inicializarBaseDeDatos()
        configurarClicks()
        cargarDatosIniciales(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(KEY_SCREEN, pantallaActual())
        outState.putInt(KEY_PUNTOS, puntos)
        outState.putInt(KEY_CASO_ACTUAL, casoActual)
        outState.putInt(KEY_DIAGNOSTICOS_CORRECTOS, diagnosticosCorrectos)
        outState.putInt(KEY_TRATAMIENTOS_CORRECTOS, tratamientosCorrectos)
        outState.putInt(KEY_SEGUNDOS_RESTANTES, segundosRestantes)
        outState.putInt(KEY_TIEMPO_TOTAL_CASO, tiempoTotalCaso)
        outState.putInt(KEY_NIVEL_INICIO_ACTUAL, nivelInicioActual)
        outState.putInt(KEY_EVALUACION_NIVEL_INICIO, evaluacionNivelInicio)
        outState.putBoolean(KEY_EVALUACION_NIVEL_APROBADA, evaluacionNivelAprobada)
        outState.putInt(KEY_CHECKPOINT_PUNTOS, checkpointNivel.puntos)
        outState.putInt(KEY_CHECKPOINT_DIAGNOSTICOS, checkpointNivel.diagnosticosCorrectos)
        outState.putInt(KEY_CHECKPOINT_TRATAMIENTOS, checkpointNivel.tratamientosCorrectos)
        outState.putString(KEY_DIAGNOSTICO_ELEGIDO, diagnosticoElegido)
        outState.putString(KEY_TRATAMIENTO_ELEGIDO, tratamientoElegido)
        outState.putBoolean(KEY_DIAGNOSTICO_CORRECTO, diagnosticoCorrectoActual)
        outState.putBoolean(KEY_TRATAMIENTO_CORRECTO, tratamientoCorrectoActual)
        outState.putBoolean(KEY_CASO_CERRADO, casoCerrado)
        outState.putBoolean(KEY_COMO_JUGAR_VISIBLE, tvComoJugar.visibility == View.VISIBLE)
        outState.putString(KEY_FEEDBACK_DIAGNOSTICO, tvFeedbackDiagnostico.text.toString())
        outState.putString(KEY_NIVEL_COMPLETADO, tvNivelCompletado.text.toString())
        outState.putString(KEY_NUEVO_NIVEL, tvNuevoNivel.text.toString())
        outState.putString(KEY_EVALUACION_NIVEL, tvEvaluacionNivel.text.toString())
        outState.putString(KEY_CONTINUAR_NIVEL_TEXTO, btnContinuarNivel.text.toString())
        outState.putStringArrayList(KEY_OPCIONES_DIAG, ArrayList(btnDiag.map { it.text.toString() }))
        outState.putStringArrayList(KEY_OPCIONES_TRAT, ArrayList(btnTrat.map { it.text.toString() }))
    }

    override fun onDestroy() {
        timer?.cancel()
        dbExecutor.shutdown()
        super.onDestroy()
    }

    private fun enlazarVistas() {
        tvRango = findViewById(R.id.tvRango)
        tvTimer = findViewById(R.id.tvTimer)
        tvPuntos = findViewById(R.id.tvPuntos)
        tvProgreso = findViewById(R.id.tvProgreso)
        tvDificultad = findViewById(R.id.tvDificultad)
        tvSiguienteRango = findViewById(R.id.tvSiguienteRango)
        tvPacienteNombre = findViewById(R.id.tvPacienteNombre)
        tvPacienteEdad = findViewById(R.id.tvPacienteEdad)
        tvSintomas = findViewById(R.id.tvSintomas)
        tvFeedbackDiagnostico = findViewById(R.id.tvFeedbackDiagnostico)
        ivPaciente = findViewById(R.id.ivPaciente)
        tvDatos = findViewById(R.id.tvDatosPaciente)
        tvFeedback = findViewById(R.id.tvFeedback)
        tvResultadoFinal = findViewById(R.id.tvResultadoFinal)
        tvResultadoRango = findViewById(R.id.tvResultadoRango)
        tvComoJugar = findViewById(R.id.tvComoJugar)
        tvNivelCompletado = findViewById(R.id.tvNivelCompletado)
        tvNuevoNivel = findViewById(R.id.tvNuevoNivel)
        tvEvaluacionNivel = findViewById(R.id.tvEvaluacionNivel)
        progressPartida = findViewById(R.id.progressPartida)
        progressRango = findViewById(R.id.progressRango)
        progressTimer = findViewById(R.id.progressTimer)
        progressNivel = findViewById(R.id.progressNivel)
        progressEvaluacionNivel = findViewById(R.id.progressEvaluacionNivel)
        tvObjetivoNivel = findViewById(R.id.tvObjetivoNivel)
        layoutInicio = findViewById(R.id.layoutInicio)
        layoutJuego = findViewById(R.id.layoutJuego)
        layoutTrat = findViewById(R.id.layoutTrat)
        layoutResultado = findViewById(R.id.layoutResultado)
        layoutNivel = findViewById(R.id.layoutNivel)
        btnJugar = findViewById(R.id.btnJugar)
        btnComoJugar = findViewById(R.id.btnComoJugar)
        btnNuevaPartida = findViewById(R.id.btnNuevaPartida)
        btnSiguiente = findViewById(R.id.btnSiguiente)
        btnJugarDeNuevo = findViewById(R.id.btnJugarDeNuevo)
        btnContinuarNivel = findViewById(R.id.btnContinuarNivel)
        btnDiag = listOf(
            findViewById(R.id.btnDiag1),
            findViewById(R.id.btnDiag2),
            findViewById(R.id.btnDiag3),
            findViewById(R.id.btnDiag4)
        )
        btnTrat = listOf(
            findViewById(R.id.btnTrat1),
            findViewById(R.id.btnTrat2),
            findViewById(R.id.btnTrat3)
        )
    }

    private fun configurarClicks() {
        btnJugar.setOnClickListener {
            if (progresoDisponible) {
                continuarPartida()
            } else {
                iniciarNuevaPartida()
            }
        }

        btnNuevaPartida.setOnClickListener {
            iniciarNuevaPartida()
        }

        btnComoJugar.setOnClickListener {
            tvComoJugar.visibility = if (tvComoJugar.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }

        btnDiag.forEach { btn ->
            btn.setOnClickListener {
                manejarDiagnostico(btn.text.toString())
            }
        }

        btnTrat.forEach { btn ->
            btn.setOnClickListener {
                manejarTratamiento(btn.text.toString())
            }
        }

        btnSiguiente.setOnClickListener {
            avanzarCaso()
        }

        btnJugarDeNuevo.setOnClickListener {
            iniciarNuevaPartida()
        }

        btnContinuarNivel.setOnClickListener {
            resolverEvaluacionNivel()
        }
    }

    private fun mostrarInicio() {
        timer?.cancel()
        layoutInicio.visibility = View.VISIBLE
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.GONE
        layoutResultado.visibility = View.GONE
        tvComoJugar.visibility = View.GONE
    }

    private fun inicializarBaseDeDatos() {
        val db = AppDatabase.getInstance(applicationContext)
        casosRepository = CasosRoomRepository(db.casoDao())
        progresoRepository = ProgresoRepository(db.progresoDao())
        btnJugar.isEnabled = false
        btnJugar.text = "CARGANDO..."
        btnNuevaPartida.visibility = View.GONE
    }

    private fun cargarDatosIniciales(savedInstanceState: Bundle?) {
        dbExecutor.execute {
            val casosGuardados = casosRepository.obtenerCasos()
            val progreso = progresoRepository.obtener()

            runOnUiThread {
                casos = casosGuardados
                btnJugar.isEnabled = true
                if (savedInstanceState == null) {
                    mostrarInicioSegunProgreso(progreso)
                } else {
                    restaurarEstado(savedInstanceState)
                }
            }
        }
    }

    private fun mostrarInicioSegunProgreso(progreso: ProgresoEntity?) {
        mostrarInicio()
        progresoDisponible = progreso != null && !progreso.partidaFinalizada
        if (progresoDisponible) {
            btnJugar.text = "CONTINUAR PARTIDA"
            btnNuevaPartida.visibility = View.VISIBLE
        } else {
            btnJugar.text = "JUGAR"
            btnNuevaPartida.visibility = View.GONE
        }
    }

    private fun restaurarEstado(savedState: Bundle) {
        puntos = savedState.getInt(KEY_PUNTOS)
        casoActual = savedState.getInt(KEY_CASO_ACTUAL)
        diagnosticosCorrectos = savedState.getInt(KEY_DIAGNOSTICOS_CORRECTOS)
        tratamientosCorrectos = savedState.getInt(KEY_TRATAMIENTOS_CORRECTOS)
        segundosRestantes = savedState.getInt(KEY_SEGUNDOS_RESTANTES)
        tiempoTotalCaso = savedState.getInt(KEY_TIEMPO_TOTAL_CASO, GameLogic.TIEMPO_PRACTICANTE)
        nivelInicioActual = savedState.getInt(KEY_NIVEL_INICIO_ACTUAL)
        evaluacionNivelInicio = savedState.getInt(KEY_EVALUACION_NIVEL_INICIO)
        evaluacionNivelAprobada = savedState.getBoolean(KEY_EVALUACION_NIVEL_APROBADA)
        checkpointNivel = GameLogic.crearCheckpoint(
            savedState.getInt(KEY_CHECKPOINT_PUNTOS),
            savedState.getInt(KEY_CHECKPOINT_DIAGNOSTICOS),
            savedState.getInt(KEY_CHECKPOINT_TRATAMIENTOS)
        )
        diagnosticoElegido = savedState.getString(KEY_DIAGNOSTICO_ELEGIDO)
        tratamientoElegido = savedState.getString(KEY_TRATAMIENTO_ELEGIDO)
        diagnosticoCorrectoActual = savedState.getBoolean(KEY_DIAGNOSTICO_CORRECTO)
        tratamientoCorrectoActual = savedState.getBoolean(KEY_TRATAMIENTO_CORRECTO)
        casoCerrado = savedState.getBoolean(KEY_CASO_CERRADO)

        when (savedState.getString(KEY_SCREEN, SCREEN_INICIO)) {
            SCREEN_JUEGO -> restaurarPantallaJuego(savedState)
            SCREEN_NIVEL -> restaurarPantallaNivel(savedState)
            SCREEN_RESULTADO -> restaurarPantallaResultado()
            else -> {
                mostrarInicio()
                tvComoJugar.visibility = if (savedState.getBoolean(KEY_COMO_JUGAR_VISIBLE)) View.VISIBLE else View.GONE
            }
        }
    }

    private fun restaurarPantallaJuego(savedState: Bundle) {
        layoutInicio.visibility = View.GONE
        layoutJuego.visibility = View.VISIBLE
        layoutNivel.visibility = View.GONE
        layoutResultado.visibility = View.GONE
        tvProgreso.visibility = View.VISIBLE
        tvDificultad.visibility = View.VISIBLE
        tvTimer.visibility = View.VISIBLE

        val opcionesDiag = savedState.getStringArrayList(KEY_OPCIONES_DIAG)
        val opcionesTrat = savedState.getStringArrayList(KEY_OPCIONES_TRAT)
        mostrarCasoActual(opcionesDiag, opcionesTrat)

        if (diagnosticoElegido != null) {
            btnDiag.forEach { it.isEnabled = false }
            marcarRespuesta(btnDiag, diagnosticoElegido.orEmpty(), casos[casoActual].diagCorrecto)
            tvFeedbackDiagnostico.text = savedState.getString(KEY_FEEDBACK_DIAGNOSTICO).orEmpty()
            tvFeedbackDiagnostico.setBackgroundResource(
                if (diagnosticoCorrectoActual) R.drawable.bg_feedback_success else R.drawable.bg_feedback_error
            )
            tvFeedbackDiagnostico.visibility = View.VISIBLE
            layoutTrat.visibility = View.VISIBLE
        }

        if (tratamientoElegido != null) {
            btnTrat.forEach { it.isEnabled = false }
            marcarRespuesta(btnTrat, tratamientoElegido.orEmpty(), casos[casoActual].tratCorrecto)
        }

        if (casoCerrado) {
            timer?.cancel()
            btnDiag.forEach { it.isEnabled = false }
            btnTrat.forEach { it.isEnabled = false }
            mostrarFeedbackFinal(tiempoAgotado = segundosRestantes == 0 && tratamientoElegido == null)
        } else {
            btnTrat.forEach { it.isEnabled = tratamientoElegido == null }
            actualizarTimerVisual()
            if (segundosRestantes > 0) {
                iniciarTimerDesde(segundosRestantes)
            } else {
                manejarTiempoAgotado()
            }
        }
    }

    private fun restaurarPantallaNivel(savedState: Bundle) {
        timer?.cancel()
        layoutInicio.visibility = View.GONE
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.VISIBLE
        layoutResultado.visibility = View.GONE
        tvNivelCompletado.text = savedState.getString(KEY_NIVEL_COMPLETADO).orEmpty()
        tvNuevoNivel.text = savedState.getString(KEY_NUEVO_NIVEL).orEmpty()
        tvEvaluacionNivel.text = savedState.getString(KEY_EVALUACION_NIVEL).orEmpty()
        btnContinuarNivel.text = savedState.getString(KEY_CONTINUAR_NIVEL_TEXTO).orEmpty()
        actualizarProgresoEvaluacion()
    }

    private fun restaurarPantallaResultado() {
        timer?.cancel()
        layoutInicio.visibility = View.GONE
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.GONE
        layoutResultado.visibility = View.VISIBLE
        mostrarResultadoFinal()
    }

    private fun iniciarNuevaPartida() {
        dbExecutor.execute {
            progresoRepository.reiniciar()
        }
        iniciarPartida()
    }

    private fun iniciarPartida() {
        timer?.cancel()
        puntos = 0
        casoActual = 0
        diagnosticosCorrectos = 0
        tratamientosCorrectos = 0
        nivelInicioActual = 0
        checkpointNivel = GameLogic.crearCheckpoint(0, 0, 0)
        evaluacionNivelInicio = 0
        evaluacionNivelAprobada = false
        layoutInicio.visibility = View.GONE
        layoutNivel.visibility = View.GONE
        layoutResultado.visibility = View.GONE
        layoutJuego.visibility = View.VISIBLE
        tvProgreso.visibility = View.VISIBLE
        tvDificultad.visibility = View.VISIBLE
        tvTimer.visibility = View.VISIBLE
        progresoDisponible = false
        btnJugar.text = "JUGAR"
        btnNuevaPartida.visibility = View.GONE
        cargarCaso()
        guardarProgreso()
    }

    private fun continuarPartida() {
        timer?.cancel()
        btnJugar.isEnabled = false
        dbExecutor.execute {
            val progreso = progresoRepository.obtener()

            runOnUiThread {
                btnJugar.isEnabled = true
                if (progreso == null || progreso.partidaFinalizada) {
                    mostrarInicioSegunProgreso(progreso)
                    return@runOnUiThread
                }

                puntos = progreso.puntosTotales
                casoActual = progreso.casoActual.coerceIn(0, casos.lastIndex)
                diagnosticosCorrectos = progreso.diagnosticosCorrectos
                tratamientosCorrectos = progreso.accionesCorrectas
                nivelInicioActual = progreso.nivelInicioActual
                checkpointNivel = GameLogic.crearCheckpoint(
                    progreso.checkpointPuntosNivel,
                    progreso.checkpointDiagnosticos,
                    progreso.checkpointAcciones
                )
                evaluacionNivelInicio = nivelInicioActual
                evaluacionNivelAprobada = false

                layoutInicio.visibility = View.GONE
                layoutNivel.visibility = View.GONE
                layoutResultado.visibility = View.GONE
                layoutJuego.visibility = View.VISIBLE
                tvProgreso.visibility = View.VISIBLE
                tvDificultad.visibility = View.VISIBLE
                tvTimer.visibility = View.VISIBLE

                if (progreso.casoCerrado) {
                    restaurarCasoCerrado(progreso)
                } else {
                    cargarCaso()
                }
            }
        }
    }

    private fun restaurarCasoCerrado(progreso: ProgresoEntity) {
        timer?.cancel()
        reiniciarEstadoDelCaso()
        diagnosticoElegido = progreso.diagnosticoElegido
        tratamientoElegido = progreso.tratamientoElegido
        diagnosticoCorrectoActual = progreso.diagnosticoCorrectoActual
        tratamientoCorrectoActual = progreso.tratamientoCorrectoActual
        segundosRestantes = progreso.segundosRestantes
        casoCerrado = true

        mostrarCasoActual()
        btnDiag.forEach { it.isEnabled = false }
        btnTrat.forEach { it.isEnabled = false }
        layoutTrat.visibility = View.VISIBLE
        diagnosticoElegido?.let {
            marcarRespuesta(btnDiag, it, casos[casoActual].diagCorrecto)
        }
        tratamientoElegido?.let {
            marcarRespuesta(btnTrat, it, casos[casoActual].tratCorrecto)
        }
        actualizarTimerVisual()
        mostrarFeedbackFinal(tiempoAgotado = segundosRestantes == 0 && tratamientoElegido == null)
    }

    private fun cargarCaso() {
        reiniciarEstadoDelCaso()
        mostrarCasoActual()
        iniciarTimer()
    }

    private fun mostrarCasoActual(
        opcionesDiagGuardadas: List<String>? = null,
        opcionesTratGuardadas: List<String>? = null
    ) {
        val caso = casos[casoActual]
        actualizarRango()
        actualizarPuntos()
        actualizarProgresoPartida()
        actualizarObjetivoNivel()

        tvProgreso.text = "Caso ${casoActual + 1} de ${casos.size}"
        actualizarDificultad(caso.dificultad)
        ivPaciente.setImageResource(caso.imagen)
        tvPacienteNombre.text = caso.nombre
        tvPacienteEdad.text = "${caso.edad} años"
        tvDatos.text = "Peso: ${caso.peso} kg   |   Talla: ${caso.talla} cm"
        tvSintomas.text = caso.sintomas

        val opcionesDiagnostico = opcionesDiagGuardadas ?: caso.opcionesDiag.shuffled()
        val opcionesAccion = opcionesTratGuardadas ?: caso.opcionesTrat.shuffled()

        opcionesDiagnostico.forEachIndexed { i, opcion ->
            btnDiag[i].text = opcion
        }
        opcionesAccion.forEachIndexed { i, opcion ->
            btnTrat[i].text = opcion
        }
    }

    private fun reiniciarEstadoDelCaso() {
        timer?.cancel()
        diagnosticoElegido = null
        tratamientoElegido = null
        diagnosticoCorrectoActual = false
        tratamientoCorrectoActual = false
        casoCerrado = false
        tvFeedback.text = ""
        tvFeedback.visibility = View.GONE
        tvFeedbackDiagnostico.text = ""
        tvFeedbackDiagnostico.visibility = View.GONE
        layoutTrat.visibility = View.GONE
        btnSiguiente.visibility = View.GONE
        btnDiag.forEach { it.isEnabled = true }
        btnTrat.forEach { it.isEnabled = true }
        restaurarBotones(btnDiag)
        restaurarBotones(btnTrat)
    }

    private fun iniciarTimer() {
        iniciarTimerDesde(tiempoPorRango())
    }

    private fun iniciarTimerDesde(segundosIniciales: Int) {
        timer?.cancel()
        tiempoTotalCaso = maxOf(1, segundosIniciales)
        segundosRestantes = segundosIniciales.coerceAtLeast(0)
        tvTimer.text = "Tiempo ${segundosRestantes} s"
        progressTimer.max = tiempoTotalCaso
        progressTimer.progress = segundosRestantes
        timer = object : CountDownTimer((segundosRestantes * 1000L), 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                segundosRestantes = (millisUntilFinished / 1000L).toInt()
                tvTimer.text = "Tiempo ${segundosRestantes} s"
                progressTimer.progress = segundosRestantes
            }

            override fun onFinish() {
                segundosRestantes = 0
                tvTimer.text = "Tiempo 0 s"
                progressTimer.progress = 0
                manejarTiempoAgotado()
            }
        }.start()
    }

    private fun manejarDiagnostico(opcion: String) {
        if (diagnosticoElegido != null || casoCerrado) return

        val caso = casos[casoActual]
        diagnosticoElegido = opcion
        diagnosticoCorrectoActual = opcion == caso.diagCorrecto
        btnDiag.forEach { it.isEnabled = false }
        marcarRespuesta(btnDiag, opcion, caso.diagCorrecto)

        if (diagnosticoCorrectoActual) {
            val puntosGanados = GameLogic.puntosPorDiagnostico(true, segundosRestantes)
            puntos += puntosGanados
            diagnosticosCorrectos++
            mostrarFeedbackDiagnostico("Buena decision\nElegiste: $opcion\n+$puntosGanados puntos", true)
            Toast.makeText(this, "+$puntosGanados puntos", Toast.LENGTH_SHORT).show()
        } else {
            val puntosPerdidos = GameLogic.puntosPorDiagnostico(false, segundosRestantes)
            puntos += puntosPerdidos
            mostrarFeedbackDiagnostico("Revisa tu decision\nElegiste: $opcion\nCorrecto: ${caso.diagCorrecto}", false)
            Toast.makeText(this, "$puntosPerdidos puntos. Era ${caso.diagCorrecto}", Toast.LENGTH_SHORT).show()
        }

        actualizarPuntos()
        actualizarRango()
        layoutTrat.visibility = View.VISIBLE
    }

    private fun manejarTratamiento(opcion: String) {
        if (diagnosticoElegido == null || tratamientoElegido != null || casoCerrado) return

        val caso = casos[casoActual]
        tratamientoElegido = opcion
        tratamientoCorrectoActual = opcion == caso.tratCorrecto
        btnTrat.forEach { it.isEnabled = false }
        marcarRespuesta(btnTrat, opcion, caso.tratCorrecto)

        if (tratamientoCorrectoActual) {
            val puntosGanados = GameLogic.puntosPorTratamiento(true)
            puntos += puntosGanados
            tratamientosCorrectos++
            Toast.makeText(this, "+$puntosGanados puntos", Toast.LENGTH_SHORT).show()
        } else {
            val puntosPerdidos = GameLogic.puntosPorTratamiento(false)
            puntos += puntosPerdidos
            Toast.makeText(this, "$puntosPerdidos puntos. Era ${caso.tratCorrecto}", Toast.LENGTH_SHORT).show()
        }

        actualizarPuntos()
        actualizarRango()
        cerrarCasoPorRespuesta()
    }

    private fun cerrarCasoPorRespuesta() {
        timer?.cancel()
        casoCerrado = true
        mostrarFeedbackFinal()
        guardarProgreso()
    }

    private fun manejarTiempoAgotado() {
        if (casoCerrado) return

        val puntosPerdidos = GameLogic.penalizacionTiempoAgotado()
        puntos += puntosPerdidos
        casoCerrado = true
        btnDiag.forEach { it.isEnabled = false }
        btnTrat.forEach { it.isEnabled = false }
        layoutTrat.visibility = View.VISIBLE
        actualizarPuntos()
        actualizarRango()
        Toast.makeText(this, "Tiempo agotado. $puntosPerdidos puntos", Toast.LENGTH_SHORT).show()
        mostrarFeedbackFinal(tiempoAgotado = true)
        guardarProgreso()
    }

    private fun mostrarFeedbackFinal(tiempoAgotado: Boolean = false) {
        val caso = casos[casoActual]
        val diagnosticoTexto = diagnosticoElegido ?: "sin responder"
        val tratamientoTexto = tratamientoElegido ?: "sin responder"
        val encabezado = when {
            tiempoAgotado -> "Tiempo agotado."
            diagnosticoCorrectoActual && tratamientoCorrectoActual -> "Buena decision"
            else -> "Revisa tu decision"
        }

        tvFeedback.setBackgroundResource(
            if (!tiempoAgotado && diagnosticoCorrectoActual && tratamientoCorrectoActual) {
                R.drawable.bg_feedback_success
            } else {
                R.drawable.bg_feedback_error
            }
        )
        tvFeedback.text = "$encabezado\n" +
            "Diagnostico elegido: $diagnosticoTexto\n" +
            "Accion elegida: $tratamientoTexto\n" +
            "Diagnostico correcto: ${caso.diagCorrecto}\n" +
            "Accion adecuada: ${caso.tratCorrecto}\n\n" +
            if (diagnosticoCorrectoActual && tratamientoCorrectoActual) caso.feedbackBien else caso.feedbackMal
        tvFeedback.visibility = View.VISIBLE
        btnSiguiente.text = if (casoActual == casos.lastIndex) "VER RESULTADO FINAL" else "SIGUIENTE CASO"
        btnSiguiente.visibility = View.VISIBLE
    }

    private fun avanzarCaso() {
        if (!casoCerrado) return

        if (casoActual == casos.lastIndex) {
            mostrarResultadoFinal()
        } else {
            val siguienteCaso = casoActual + 1
            if (siguienteCaso == 5) {
                mostrarEvaluacionNivel("FACIL", "MEDIO", GameLogic.PUNTOS_PARA_MEDIO, GameLogic.puedeDesbloquearMedio(puntos), 0)
            } else if (siguienteCaso == 10) {
                mostrarEvaluacionNivel("MEDIO", "DIFICIL", GameLogic.PUNTOS_PARA_DIFICIL, GameLogic.puedeDesbloquearDificil(puntos), 5)
            } else {
                casoActual = siguienteCaso
                cargarCaso()
                guardarProgreso()
            }
        }
    }

    private fun mostrarResultadoFinal() {
        timer?.cancel()
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.GONE
        layoutResultado.visibility = View.VISIBLE
        tvTimer.visibility = View.GONE
        tvProgreso.visibility = View.GONE
        tvDificultad.visibility = View.GONE
        actualizarRango()

        val totalRespuestas = casos.size * 2
        val respuestasCorrectas = diagnosticosCorrectos + tratamientosCorrectos
        val precision = (respuestasCorrectas * 100) / totalRespuestas
        tvResultadoRango.text = calcularRango()
        tvResultadoFinal.text = "Puntuacion total: $puntos\n" +
            "Casos completados: ${casos.size}\n" +
            "Diagnosticos correctos: $diagnosticosCorrectos/${casos.size}\n" +
            "Acciones correctas: $tratamientosCorrectos/${casos.size}\n" +
            "Precision: $precision%"
        guardarProgreso(partidaFinalizada = true)
    }

    private fun actualizarPuntos() {
        tvPuntos.text = "$puntos pts"
        actualizarObjetivoNivel()
    }

    private fun actualizarRango() {
        val rango = calcularRango()
        tvRango.text = rango
        actualizarProgresoRango(rango)
    }

    private fun actualizarProgresoPartida() {
        progressPartida.max = casos.size
        progressPartida.progress = casoActual + 1
    }

    private fun actualizarTimerVisual() {
        progressTimer.max = maxOf(1, tiempoTotalCaso)
        progressTimer.progress = segundosRestantes.coerceIn(0, progressTimer.max)
        tvTimer.text = "Tiempo ${segundosRestantes} s"
    }

    private fun actualizarObjetivoNivel() {
        val objetivo = objetivoNivelActual()
        if (objetivo == null) {
            tvObjetivoNivel.text = "NIVEL FINAL"
            progressNivel.max = 100
            progressNivel.progress = 100
        } else {
            val (requerido, siguienteNivel) = objetivo
            tvObjetivoNivel.text = "OBJETIVO: alcanza $requerido pts para desbloquear $siguienteNivel"
            progressNivel.max = requerido
            progressNivel.progress = puntos.coerceIn(0, requerido)
        }
    }

    private fun actualizarProgresoEvaluacion() {
        val requerido = when (evaluacionNivelInicio) {
            0 -> GameLogic.PUNTOS_PARA_MEDIO
            5 -> GameLogic.PUNTOS_PARA_DIFICIL
            else -> 1
        }
        progressEvaluacionNivel.max = requerido
        progressEvaluacionNivel.progress = puntos.coerceIn(0, requerido)
    }

    private fun objetivoNivelActual(): Pair<Int, String>? = when (casoActual) {
        in 0..4 -> GameLogic.PUNTOS_PARA_MEDIO to "MEDIO"
        in 5..9 -> GameLogic.PUNTOS_PARA_DIFICIL to "DIFICIL"
        else -> null
    }

    private fun actualizarDificultad(dificultad: String) {
        tvDificultad.text = dificultad
        val color = when (dificultad) {
            "FACIL" -> R.color.vitalis_success
            "MEDIO" -> R.color.vitalis_warning
            else -> R.color.vitalis_hard
        }
        tvDificultad.setTextColor(getColor(color))
    }

    private fun mostrarFeedbackDiagnostico(texto: String, correcto: Boolean) {
        tvFeedbackDiagnostico.setBackgroundResource(
            if (correcto) R.drawable.bg_feedback_success else R.drawable.bg_feedback_error
        )
        tvFeedbackDiagnostico.text = texto
        tvFeedbackDiagnostico.visibility = View.VISIBLE
    }

    private fun mostrarTransicionNivel(nivelCompletado: String, nuevoNivel: String) {
        timer?.cancel()
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.VISIBLE
        tvNivelCompletado.text = "NIVEL COMPLETADO\n$nivelCompletado"
        tvNuevoNivel.text = "Nuevo nivel: $nuevoNivel"
    }

    private fun mostrarEvaluacionNivel(
        nivelCompletado: String,
        nuevoNivel: String,
        puntosNecesarios: Int,
        aprobado: Boolean,
        inicioNivelEvaluado: Int
    ) {
        timer?.cancel()
        evaluacionNivelInicio = inicioNivelEvaluado
        evaluacionNivelAprobada = aprobado
        layoutJuego.visibility = View.GONE
        layoutNivel.visibility = View.VISIBLE
        tvNivelCompletado.text = "NIVEL $nivelCompletado COMPLETADO"
        tvNuevoNivel.text = if (aprobado) {
            "NIVEL $nuevoNivel DESBLOQUEADO"
        } else {
            "TODAVIA NO ALCANZASTE EL PUNTAJE NECESARIO"
        }
        tvEvaluacionNivel.text = "Puntuacion actual: $puntos pts\n" +
            "Puntos necesarios para $nuevoNivel: $puntosNecesarios pts"
        btnContinuarNivel.text = if (aprobado) "CONTINUAR" else "REINTENTAR NIVEL $nivelCompletado"
        actualizarProgresoEvaluacion()
    }

    private fun resolverEvaluacionNivel() {
        if (evaluacionNivelAprobada) {
            checkpointNivel = GameLogic.crearCheckpoint(puntos, diagnosticosCorrectos, tratamientosCorrectos)
            nivelInicioActual = when (evaluacionNivelInicio) {
                0 -> 5
                5 -> 10
                else -> evaluacionNivelInicio
            }
            casoActual = nivelInicioActual
        } else {
            restaurarCheckpointNivel()
            casoActual = evaluacionNivelInicio
            nivelInicioActual = evaluacionNivelInicio
        }
        layoutNivel.visibility = View.GONE
        layoutJuego.visibility = View.VISIBLE
        cargarCaso()
        guardarProgreso()
    }

    private fun restaurarCheckpointNivel() {
        puntos = checkpointNivel.puntos
        diagnosticosCorrectos = checkpointNivel.diagnosticosCorrectos
        tratamientosCorrectos = checkpointNivel.tratamientosCorrectos
    }

    private fun restaurarBotones(botones: List<Button>) {
        botones.forEach { btn ->
            btn.alpha = 1f
            btn.setTextColor(getColor(R.color.vitalis_text))
            btn.backgroundTintList = colorList(R.color.vitalis_surface_soft)
        }
    }

    private fun marcarRespuesta(botones: List<Button>, elegida: String, correcta: String) {
        botones.forEach { btn ->
            val texto = btn.text.toString()
            when {
                texto == correcta -> {
                    btn.alpha = 1f
                    btn.setTextColor(getColor(R.color.white))
                    btn.backgroundTintList = colorList(R.color.vitalis_success)
                }
                texto == elegida -> {
                    btn.alpha = 1f
                    btn.setTextColor(getColor(R.color.white))
                    btn.backgroundTintList = colorList(R.color.vitalis_error)
                }
                else -> {
                    btn.alpha = 0.72f
                    btn.setTextColor(getColor(R.color.vitalis_muted))
                    btn.backgroundTintList = colorList(R.color.vitalis_surface_soft)
                }
            }
        }
    }

    private fun actualizarProgresoRango(rango: String) {
        val inicio: Int
        val siguiente: Int?
        val siguienteNombre: String

        when (rango) {
            GameLogic.RANGO_PRACTICANTE -> {
                inicio = 0
                siguiente = GameLogic.LIMITE_INTERNO
                siguienteNombre = GameLogic.RANGO_INTERNO
            }
            GameLogic.RANGO_INTERNO -> {
                inicio = GameLogic.LIMITE_INTERNO
                siguiente = GameLogic.LIMITE_RESIDENTE
                siguienteNombre = GameLogic.RANGO_RESIDENTE
            }
            GameLogic.RANGO_RESIDENTE -> {
                inicio = GameLogic.LIMITE_RESIDENTE
                siguiente = GameLogic.LIMITE_ESPECIALISTA
                siguienteNombre = GameLogic.RANGO_ESPECIALISTA
            }
            GameLogic.RANGO_ESPECIALISTA -> {
                inicio = GameLogic.LIMITE_ESPECIALISTA
                siguiente = GameLogic.LIMITE_JEFE_MEDICO
                siguienteNombre = GameLogic.RANGO_JEFE_MEDICO
            }
            else -> {
                inicio = GameLogic.LIMITE_JEFE_MEDICO
                siguiente = null
                siguienteNombre = ""
            }
        }

        if (siguiente == null) {
            progressRango.max = 100
            progressRango.progress = 100
            tvSiguienteRango.text = "Rango maximo"
        } else {
            progressRango.max = siguiente - inicio
            progressRango.progress = (puntos - inicio).coerceIn(0, progressRango.max)
            tvSiguienteRango.text = "Siguiente: $siguienteNombre $siguiente pts"
        }
    }

    private fun colorList(colorRes: Int): ColorStateList {
        return ColorStateList.valueOf(getColor(colorRes))
    }

    private fun pantallaActual(): String = when {
        layoutJuego.visibility == View.VISIBLE -> SCREEN_JUEGO
        layoutNivel.visibility == View.VISIBLE -> SCREEN_NIVEL
        layoutResultado.visibility == View.VISIBLE -> SCREEN_RESULTADO
        else -> SCREEN_INICIO
    }

    private fun calcularRango(): String = GameLogic.calcularRango(puntos)

    private fun tiempoPorRango(): Int = GameLogic.tiempoPorPuntos(puntos)

    private fun guardarProgreso(partidaFinalizada: Boolean = false) {
        if (casos.isEmpty()) return

        val puntosActuales = puntos
        val casoActualGuardado = casoActual.coerceIn(0, casos.lastIndex)
        val diagnosticos = diagnosticosCorrectos
        val tratamientos = tratamientosCorrectos
        val checkpoint = checkpointNivel
        val nivelInicio = nivelInicioActual
        val casoEstaCerrado = casoCerrado
        val diagnostico = diagnosticoElegido
        val tratamiento = tratamientoElegido
        val diagnosticoCorrecto = diagnosticoCorrectoActual
        val tratamientoCorrecto = tratamientoCorrectoActual
        val segundos = segundosRestantes

        dbExecutor.execute {
            progresoRepository.guardar(
                puntos = puntosActuales,
                casoActual = casoActualGuardado,
                diagnosticosCorrectos = diagnosticos,
                accionesCorrectas = tratamientos,
                checkpoint = checkpoint,
                nivelInicioActual = nivelInicio,
                partidaFinalizada = partidaFinalizada,
                casoCerrado = casoEstaCerrado,
                diagnosticoElegido = diagnostico,
                tratamientoElegido = tratamiento,
                diagnosticoCorrectoActual = diagnosticoCorrecto,
                tratamientoCorrectoActual = tratamientoCorrecto,
                segundosRestantes = segundos
            )
        }
    }

    companion object {
        private const val SCREEN_INICIO = "inicio"
        private const val SCREEN_JUEGO = "juego"
        private const val SCREEN_NIVEL = "nivel"
        private const val SCREEN_RESULTADO = "resultado"

        private const val KEY_SCREEN = "screen"
        private const val KEY_PUNTOS = "puntos"
        private const val KEY_CASO_ACTUAL = "caso_actual"
        private const val KEY_DIAGNOSTICOS_CORRECTOS = "diagnosticos_correctos"
        private const val KEY_TRATAMIENTOS_CORRECTOS = "tratamientos_correctos"
        private const val KEY_SEGUNDOS_RESTANTES = "segundos_restantes"
        private const val KEY_TIEMPO_TOTAL_CASO = "tiempo_total_caso"
        private const val KEY_NIVEL_INICIO_ACTUAL = "nivel_inicio_actual"
        private const val KEY_EVALUACION_NIVEL_INICIO = "evaluacion_nivel_inicio"
        private const val KEY_EVALUACION_NIVEL_APROBADA = "evaluacion_nivel_aprobada"
        private const val KEY_CHECKPOINT_PUNTOS = "checkpoint_puntos"
        private const val KEY_CHECKPOINT_DIAGNOSTICOS = "checkpoint_diagnosticos"
        private const val KEY_CHECKPOINT_TRATAMIENTOS = "checkpoint_tratamientos"
        private const val KEY_DIAGNOSTICO_ELEGIDO = "diagnostico_elegido"
        private const val KEY_TRATAMIENTO_ELEGIDO = "tratamiento_elegido"
        private const val KEY_DIAGNOSTICO_CORRECTO = "diagnostico_correcto"
        private const val KEY_TRATAMIENTO_CORRECTO = "tratamiento_correcto"
        private const val KEY_CASO_CERRADO = "caso_cerrado"
        private const val KEY_COMO_JUGAR_VISIBLE = "como_jugar_visible"
        private const val KEY_FEEDBACK_DIAGNOSTICO = "feedback_diagnostico"
        private const val KEY_NIVEL_COMPLETADO = "nivel_completado"
        private const val KEY_NUEVO_NIVEL = "nuevo_nivel"
        private const val KEY_EVALUACION_NIVEL = "evaluacion_nivel"
        private const val KEY_CONTINUAR_NIVEL_TEXTO = "continuar_nivel_texto"
        private const val KEY_OPCIONES_DIAG = "opciones_diag"
        private const val KEY_OPCIONES_TRAT = "opciones_trat"
    }
}
