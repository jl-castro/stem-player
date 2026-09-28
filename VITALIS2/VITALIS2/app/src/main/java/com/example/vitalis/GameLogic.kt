package com.example.vitalis

object GameLogic {
    const val PUNTOS_DIAGNOSTICO_CORRECTO = 10
    const val PUNTOS_DIAGNOSTICO_ERROR = 5
    const val PUNTOS_TRATAMIENTO_CORRECTO = 20
    const val PUNTOS_TRATAMIENTO_ERROR = 10
    const val PUNTOS_TIEMPO_AGOTADO = 10

    const val LIMITE_INTERNO = 100
    const val LIMITE_RESIDENTE = 250
    const val LIMITE_ESPECIALISTA = 450
    const val LIMITE_JEFE_MEDICO = 700

    const val RANGO_PRACTICANTE = "PRACTICANTE"
    const val RANGO_INTERNO = "INTERNO"
    const val RANGO_RESIDENTE = "RESIDENTE"
    const val RANGO_ESPECIALISTA = "ESPECIALISTA"
    const val RANGO_JEFE_MEDICO = "JEFE MEDICO"

    const val TIEMPO_PRACTICANTE = 40
    const val TIEMPO_INTERNO = 35
    const val TIEMPO_RESIDENTE = 30
    const val TIEMPO_ESPECIALISTA = 25
    const val TIEMPO_JEFE_MEDICO = 20

    const val PUNTOS_PARA_MEDIO = 180
    const val PUNTOS_PARA_DIFICIL = 400

    data class ProgresoCheckpoint(
        val puntos: Int,
        val diagnosticosCorrectos: Int,
        val tratamientosCorrectos: Int
    )

    fun puntosPorDiagnostico(correcto: Boolean, segundosRestantes: Int): Int {
        return if (correcto) {
            PUNTOS_DIAGNOSTICO_CORRECTO + bonusTiempo(segundosRestantes)
        } else {
            -PUNTOS_DIAGNOSTICO_ERROR
        }
    }

    fun puntosPorTratamiento(correcto: Boolean): Int {
        return if (correcto) PUNTOS_TRATAMIENTO_CORRECTO else -PUNTOS_TRATAMIENTO_ERROR
    }

    fun penalizacionTiempoAgotado(): Int = -PUNTOS_TIEMPO_AGOTADO

    fun bonusTiempo(segundosRestantes: Int): Int = maxOf(0, segundosRestantes)

    fun calcularRango(puntos: Int): String = when {
        puntos < LIMITE_INTERNO -> RANGO_PRACTICANTE
        puntos < LIMITE_RESIDENTE -> RANGO_INTERNO
        puntos < LIMITE_ESPECIALISTA -> RANGO_RESIDENTE
        puntos < LIMITE_JEFE_MEDICO -> RANGO_ESPECIALISTA
        else -> RANGO_JEFE_MEDICO
    }

    fun tiempoPorRango(rango: String): Int = when (rango) {
        RANGO_PRACTICANTE -> TIEMPO_PRACTICANTE
        RANGO_INTERNO -> TIEMPO_INTERNO
        RANGO_RESIDENTE -> TIEMPO_RESIDENTE
        RANGO_ESPECIALISTA -> TIEMPO_ESPECIALISTA
        else -> TIEMPO_JEFE_MEDICO
    }

    fun tiempoPorPuntos(puntos: Int): Int = tiempoPorRango(calcularRango(puntos))

    fun puedeDesbloquearMedio(puntos: Int): Boolean = puntos >= PUNTOS_PARA_MEDIO

    fun puedeDesbloquearDificil(puntos: Int): Boolean = puntos >= PUNTOS_PARA_DIFICIL

    fun crearCheckpoint(
        puntos: Int,
        diagnosticosCorrectos: Int,
        tratamientosCorrectos: Int
    ): ProgresoCheckpoint {
        return ProgresoCheckpoint(puntos, diagnosticosCorrectos, tratamientosCorrectos)
    }
}
