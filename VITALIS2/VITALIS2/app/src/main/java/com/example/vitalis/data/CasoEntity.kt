package com.example.vitalis.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "casos")
data class CasoEntity(
    @PrimaryKey val id: Int,
    val nombrePaciente: String,
    val edad: Int,
    val peso: Float,
    val talla: Float,
    val sintomas: String,
    val dificultad: String,
    val opcionesDiagnostico: List<String>,
    val diagnosticoCorrecto: String,
    val opcionesAccion: List<String>,
    val accionCorrecta: String,
    val feedbackBien: String,
    val feedbackMal: String,
    val imagenResName: String
)
