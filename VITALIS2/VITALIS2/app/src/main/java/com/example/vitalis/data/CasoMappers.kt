package com.example.vitalis.data

import com.example.vitalis.Caso
import com.example.vitalis.R

fun CasoEntity.toCaso(): Caso {
    return Caso(
        dificultad = dificultad,
        imagen = imagenResName.toDrawableRes(),
        nombre = nombrePaciente,
        edad = edad,
        peso = peso,
        talla = talla,
        sintomas = sintomas,
        diagCorrecto = diagnosticoCorrecto,
        opcionesDiag = opcionesDiagnostico,
        tratCorrecto = accionCorrecta,
        opcionesTrat = opcionesAccion,
        feedbackBien = feedbackBien,
        feedbackMal = feedbackMal
    )
}

fun Caso.toEntity(id: Int): CasoEntity {
    return CasoEntity(
        id = id,
        nombrePaciente = nombre,
        edad = edad,
        peso = peso,
        talla = talla,
        sintomas = sintomas,
        dificultad = dificultad,
        opcionesDiagnostico = opcionesDiag,
        diagnosticoCorrecto = diagCorrecto,
        opcionesAccion = opcionesTrat,
        accionCorrecta = tratCorrecto,
        feedbackBien = feedbackBien,
        feedbackMal = feedbackMal,
        imagenResName = imagen.toImageName()
    )
}

private fun Int.toImageName(): String = when (this) {
    R.drawable.paciente1 -> "paciente1"
    R.drawable.paciente2 -> "paciente2"
    R.drawable.paciente3 -> "paciente3"
    R.drawable.paciente4 -> "paciente4"
    R.drawable.paciente5 -> "paciente5"
    else -> "paciente1"
}

private fun String.toDrawableRes(): Int = when (this) {
    "paciente1" -> R.drawable.paciente1
    "paciente2" -> R.drawable.paciente2
    "paciente3" -> R.drawable.paciente3
    "paciente4" -> R.drawable.paciente4
    "paciente5" -> R.drawable.paciente5
    else -> R.drawable.paciente1
}
