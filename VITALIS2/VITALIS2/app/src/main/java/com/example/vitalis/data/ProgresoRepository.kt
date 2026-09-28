package com.example.vitalis.data

import com.example.vitalis.GameLogic

class ProgresoRepository(private val progresoDao: ProgresoDao) {
    fun obtener(): ProgresoEntity? = progresoDao.obtener()

    fun guardar(
        puntos: Int,
        casoActual: Int,
        diagnosticosCorrectos: Int,
        accionesCorrectas: Int,
        checkpoint: GameLogic.ProgresoCheckpoint,
        nivelInicioActual: Int,
        partidaFinalizada: Boolean,
        casoCerrado: Boolean = false,
        diagnosticoElegido: String? = null,
        tratamientoElegido: String? = null,
        diagnosticoCorrectoActual: Boolean = false,
        tratamientoCorrectoActual: Boolean = false,
        segundosRestantes: Int = 0
    ) {
        progresoDao.guardar(
            ProgresoEntity(
                puntosTotales = puntos,
                rangoActual = GameLogic.calcularRango(puntos),
                nivelActual = nivelDesdeCaso(casoActual),
                casoActual = casoActual,
                diagnosticosCorrectos = diagnosticosCorrectos,
                accionesCorrectas = accionesCorrectas,
                checkpointPuntosNivel = checkpoint.puntos,
                checkpointDiagnosticos = checkpoint.diagnosticosCorrectos,
                checkpointAcciones = checkpoint.tratamientosCorrectos,
                nivelInicioActual = nivelInicioActual,
                partidaFinalizada = partidaFinalizada,
                casoCerrado = casoCerrado,
                diagnosticoElegido = diagnosticoElegido,
                tratamientoElegido = tratamientoElegido,
                diagnosticoCorrectoActual = diagnosticoCorrectoActual,
                tratamientoCorrectoActual = tratamientoCorrectoActual,
                segundosRestantes = segundosRestantes
            )
        )
    }

    fun reiniciar() {
        progresoDao.reiniciar()
    }

    private fun nivelDesdeCaso(casoActual: Int): String = when (casoActual) {
        in 0..4 -> "FACIL"
        in 5..9 -> "MEDIO"
        else -> "DIFICIL"
    }
}
