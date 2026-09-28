package com.example.vitalis

data class Caso(
    val dificultad: String,
    val imagen: Int,
    val nombre: String,
    val edad: Int,
    val peso: Float,
    val talla: Float,
    val sintomas: String,
    val diagCorrecto: String,
    val opcionesDiag: List<String>,
    val tratCorrecto: String,
    val opcionesTrat: List<String>,
    val feedbackBien: String,
    val feedbackMal: String
)
