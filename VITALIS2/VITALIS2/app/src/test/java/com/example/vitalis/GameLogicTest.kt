package com.example.vitalis

import org.junit.Assert.assertEquals
import org.junit.Test

class GameLogicTest {

    @Test
    fun diagnosticoCorrectoSumaBaseMasBonus() {
        assertEquals(25, GameLogic.puntosPorDiagnostico(correcto = true, segundosRestantes = 15))
    }

    @Test
    fun diagnosticoIncorrectoRestaPenalizacion() {
        assertEquals(-5, GameLogic.puntosPorDiagnostico(correcto = false, segundosRestantes = 15))
    }

    @Test
    fun tratamientoCorrectoSumaPuntos() {
        assertEquals(20, GameLogic.puntosPorTratamiento(correcto = true))
    }

    @Test
    fun tratamientoIncorrectoRestaPenalizacion() {
        assertEquals(-10, GameLogic.puntosPorTratamiento(correcto = false))
    }

    @Test
    fun tiempoAgotadoAplicaPenalizacion() {
        assertEquals(-10, GameLogic.penalizacionTiempoAgotado())
    }

    @Test
    fun bonusDeTiempoUsaSegundosRestantes() {
        assertEquals(32, GameLogic.bonusTiempo(32))
    }

    @Test
    fun bonusDeTiempoNoPuedeSerNegativo() {
        assertEquals(0, GameLogic.bonusTiempo(-8))
        assertEquals(10, GameLogic.puntosPorDiagnostico(correcto = true, segundosRestantes = -8))
    }

    @Test
    fun practicanteSeCalculaCorrectamente() {
        assertEquals(GameLogic.RANGO_PRACTICANTE, GameLogic.calcularRango(0))
    }

    @Test
    fun internoSeCalculaCorrectamente() {
        assertEquals(GameLogic.RANGO_INTERNO, GameLogic.calcularRango(GameLogic.LIMITE_INTERNO))
    }

    @Test
    fun residenteSeCalculaCorrectamente() {
        assertEquals(GameLogic.RANGO_RESIDENTE, GameLogic.calcularRango(GameLogic.LIMITE_RESIDENTE))
    }

    @Test
    fun especialistaSeCalculaCorrectamente() {
        assertEquals(GameLogic.RANGO_ESPECIALISTA, GameLogic.calcularRango(GameLogic.LIMITE_ESPECIALISTA))
    }

    @Test
    fun jefeMedicoSeCalculaCorrectamente() {
        assertEquals(GameLogic.RANGO_JEFE_MEDICO, GameLogic.calcularRango(GameLogic.LIMITE_JEFE_MEDICO))
    }

    @Test
    fun limitesEntreRangosSonExactos() {
        assertEquals(GameLogic.RANGO_PRACTICANTE, GameLogic.calcularRango(GameLogic.LIMITE_INTERNO - 1))
        assertEquals(GameLogic.RANGO_INTERNO, GameLogic.calcularRango(GameLogic.LIMITE_INTERNO))
        assertEquals(GameLogic.RANGO_INTERNO, GameLogic.calcularRango(GameLogic.LIMITE_RESIDENTE - 1))
        assertEquals(GameLogic.RANGO_RESIDENTE, GameLogic.calcularRango(GameLogic.LIMITE_RESIDENTE))
        assertEquals(GameLogic.RANGO_RESIDENTE, GameLogic.calcularRango(GameLogic.LIMITE_ESPECIALISTA - 1))
        assertEquals(GameLogic.RANGO_ESPECIALISTA, GameLogic.calcularRango(GameLogic.LIMITE_ESPECIALISTA))
        assertEquals(GameLogic.RANGO_ESPECIALISTA, GameLogic.calcularRango(GameLogic.LIMITE_JEFE_MEDICO - 1))
        assertEquals(GameLogic.RANGO_JEFE_MEDICO, GameLogic.calcularRango(GameLogic.LIMITE_JEFE_MEDICO))
    }

    @Test
    fun tiempoDisponibleDependeDelRango() {
        assertEquals(40, GameLogic.tiempoPorRango(GameLogic.RANGO_PRACTICANTE))
        assertEquals(35, GameLogic.tiempoPorRango(GameLogic.RANGO_INTERNO))
        assertEquals(30, GameLogic.tiempoPorRango(GameLogic.RANGO_RESIDENTE))
        assertEquals(25, GameLogic.tiempoPorRango(GameLogic.RANGO_ESPECIALISTA))
        assertEquals(20, GameLogic.tiempoPorRango(GameLogic.RANGO_JEFE_MEDICO))
    }

    @Test
    fun partidaPerfectaDeQuinceCasosTienePuntuacionYRangoFinalExactos() {
        var puntos = 0

        repeat(15) {
            val tiempoDisponible = GameLogic.tiempoPorPuntos(puntos)
            val bonus = GameLogic.bonusTiempo(tiempoDisponible)

            assertEquals(tiempoDisponible, bonus)

            puntos += GameLogic.puntosPorDiagnostico(
                correcto = true,
                segundosRestantes = tiempoDisponible
            )
            puntos += GameLogic.puntosPorTratamiento(correcto = true)
        }

        assertEquals(875, puntos)
        assertEquals(GameLogic.RANGO_JEFE_MEDICO, GameLogic.calcularRango(puntos))
    }

    @Test
    fun limitesSolicitadosDePuntuacionDevuelvenRangoCorrecto() {
        val casos = mapOf(
            -1 to GameLogic.RANGO_PRACTICANTE,
            0 to GameLogic.RANGO_PRACTICANTE,
            99 to GameLogic.RANGO_PRACTICANTE,
            100 to GameLogic.RANGO_INTERNO,
            249 to GameLogic.RANGO_INTERNO,
            250 to GameLogic.RANGO_RESIDENTE,
            449 to GameLogic.RANGO_RESIDENTE,
            450 to GameLogic.RANGO_ESPECIALISTA,
            699 to GameLogic.RANGO_ESPECIALISTA,
            700 to GameLogic.RANGO_JEFE_MEDICO
        )

        casos.forEach { (puntos, rangoEsperado) ->
            assertEquals(rangoEsperado, GameLogic.calcularRango(puntos))
        }
    }

    @Test
    fun medioNoSeDesbloqueaConUnPuntoMenosDelMinimo() {
        assertEquals(false, GameLogic.puedeDesbloquearMedio(GameLogic.PUNTOS_PARA_MEDIO - 1))
    }

    @Test
    fun medioSeDesbloqueaExactamenteEnElMinimo() {
        assertEquals(true, GameLogic.puedeDesbloquearMedio(GameLogic.PUNTOS_PARA_MEDIO))
    }

    @Test
    fun medioSeDesbloqueaPorEncimaDelMinimo() {
        assertEquals(true, GameLogic.puedeDesbloquearMedio(GameLogic.PUNTOS_PARA_MEDIO + 1))
    }

    @Test
    fun dificilNoSeDesbloqueaConUnPuntoMenosDelMinimo() {
        assertEquals(false, GameLogic.puedeDesbloquearDificil(GameLogic.PUNTOS_PARA_DIFICIL - 1))
    }

    @Test
    fun dificilSeDesbloqueaExactamenteEnElMinimo() {
        assertEquals(true, GameLogic.puedeDesbloquearDificil(GameLogic.PUNTOS_PARA_DIFICIL))
    }

    @Test
    fun dificilSeDesbloqueaPorEncimaDelMinimo() {
        assertEquals(true, GameLogic.puedeDesbloquearDificil(GameLogic.PUNTOS_PARA_DIFICIL + 1))
    }

    @Test
    fun reintentarFacilRestauraCheckpointInicial() {
        val checkpoint = GameLogic.crearCheckpoint(
            puntos = 0,
            diagnosticosCorrectos = 0,
            tratamientosCorrectos = 0
        )

        assertEquals(0, checkpoint.puntos)
        assertEquals(0, checkpoint.diagnosticosCorrectos)
        assertEquals(0, checkpoint.tratamientosCorrectos)
    }

    @Test
    fun reintentarMedioConservaPuntajePrevioAlNivel() {
        val checkpoint = GameLogic.crearCheckpoint(
            puntos = 210,
            diagnosticosCorrectos = 4,
            tratamientosCorrectos = 4
        )

        assertEquals(210, checkpoint.puntos)
        assertEquals(4, checkpoint.diagnosticosCorrectos)
        assertEquals(4, checkpoint.tratamientosCorrectos)
    }

    @Test
    fun repetirNivelNoAcumulaPuntosDelIntentoFallido() {
        val checkpoint = GameLogic.crearCheckpoint(
            puntos = 210,
            diagnosticosCorrectos = 4,
            tratamientosCorrectos = 4
        )
        val puntosDespuesDeIntentoFallido = 360
        val puntosAlReintentar = checkpoint.puntos

        assertEquals(360, puntosDespuesDeIntentoFallido)
        assertEquals(210, puntosAlReintentar)
    }

    @Test
    fun rangosSiguenFuncionandoIndependientementeDelNivel() {
        assertEquals(GameLogic.RANGO_INTERNO, GameLogic.calcularRango(GameLogic.PUNTOS_PARA_MEDIO))
        assertEquals(GameLogic.RANGO_RESIDENTE, GameLogic.calcularRango(GameLogic.PUNTOS_PARA_DIFICIL))
        assertEquals(true, GameLogic.puedeDesbloquearMedio(GameLogic.PUNTOS_PARA_MEDIO))
        assertEquals(true, GameLogic.puedeDesbloquearDificil(GameLogic.PUNTOS_PARA_DIFICIL))
    }
}
