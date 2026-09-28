package com.example.vitalis.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "progreso")
data class ProgresoEntity(
    @PrimaryKey val id: Int = 1,
    val puntosTotales: Int,
    val rangoActual: String,
    val nivelActual: String,
    val casoActual: Int,
    val diagnosticosCorrectos: Int,
    val accionesCorrectas: Int,
    val checkpointPuntosNivel: Int,
    val checkpointDiagnosticos: Int,
    val checkpointAcciones: Int,
    val nivelInicioActual: Int,
    val partidaFinalizada: Boolean,
    val casoCerrado: Boolean,
    val diagnosticoElegido: String?,
    val tratamientoElegido: String?,
    val diagnosticoCorrectoActual: Boolean,
    val tratamientoCorrectoActual: Boolean,
    val segundosRestantes: Int
)
