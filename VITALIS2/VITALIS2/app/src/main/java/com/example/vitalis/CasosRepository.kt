package com.example.vitalis

object CasosRepository {
    fun obtenerCasos(): List<Caso> = listOf(
        Caso(
            "FACIL",
            R.drawable.paciente1,
            "Luis",
            20,
            65f,
            170f,
            "Fiebre leve, tos seca, dolor muscular y cansancio que comenzaron ayer.",
            "Gripe",
            listOf("Gripe", "Resfriado comun", "Alergia respiratoria", "Faringitis"),
            "Reposo, hidratacion y observar la evolucion",
            listOf(
                "Reposo, hidratacion y observar la evolucion",
                "Tomar antibioticos por cuenta propia",
                "Continuar actividad fisica intensa"
            ),
            "Buena decision. El cuadro es compatible con gripe leve y conviene reposo, hidratacion y observacion.",
            "Revisa las pistas: fiebre leve, tos seca, dolor muscular y cansancio orientan a gripe. La accion adecuada era reposo, hidratacion y observar."
        ),
        Caso(
            "FACIL",
            R.drawable.paciente2,
            "Maria",
            15,
            50f,
            160f,
            "Dolor de cabeza pulsatil, nauseas y molestia intensa con la luz. Ha tenido episodios similares anteriormente.",
            "Migrana",
            listOf("Migrana", "Cefalea tensional", "Sinusitis", "Resfriado comun"),
            "Descansar en un lugar tranquilo y oscuro",
            listOf(
                "Descansar en un lugar tranquilo y oscuro",
                "Realizar ejercicio intenso",
                "Tomar antibioticos sin evaluacion"
            ),
            "Correcto. El dolor pulsatil con nausea y molestia a la luz orienta a migrana.",
            "La mejor respuesta era migrana y descansar en un lugar tranquilo y oscuro."
        ),
        Caso(
            "FACIL",
            R.drawable.paciente3,
            "Pedro",
            30,
            80f,
            180f,
            "Estornudos frecuentes, picazon en nariz, ojos llorosos y secrecion nasal transparente. No tiene fiebre.",
            "Alergia respiratoria",
            listOf("Alergia respiratoria", "Resfriado comun", "Gripe", "Sinusitis"),
            "Evitar el desencadenante y consultar si los sintomas persisten",
            listOf(
                "Evitar el desencadenante y consultar si los sintomas persisten",
                "Tomar antibioticos",
                "Hacer ejercicio intenso hasta que desaparezcan los sintomas"
            ),
            "Muy bien. La ausencia de fiebre y la picazon orientan a alergia respiratoria.",
            "La mejor respuesta era alergia respiratoria y evitar el desencadenante, con consulta si persiste."
        ),
        Caso(
            "FACIL",
            R.drawable.paciente4,
            "Ana",
            25,
            55f,
            165f,
            "Dolor de garganta leve, molestia al tragar y voz algo ronca. No presenta dificultad respiratoria ni fiebre alta.",
            "Faringitis",
            listOf("Faringitis", "Amigdalitis grave", "Alergia respiratoria", "Otitis"),
            "Hidratacion, reposo y vigilancia de sintomas",
            listOf(
                "Hidratacion, reposo y vigilancia de sintomas",
                "Iniciar antibioticos sin evaluacion medica",
                "Ignorar los sintomas aunque empeoren"
            ),
            "Correcto. Es un cuadro leve de garganta sin signos de alarma claros.",
            "La mejor respuesta era faringitis con hidratacion, reposo y vigilancia."
        ),
        Caso(
            "FACIL",
            R.drawable.paciente5,
            "Carlos",
            40,
            90f,
            175f,
            "Despues de cargar varias cajas pesadas presenta dolor en los musculos de la espalda y brazos. Puede moverlos normalmente y no hubo golpe.",
            "Sobreesfuerzo muscular",
            listOf("Sobreesfuerzo muscular", "Fractura", "Esguince", "Tendinitis"),
            "Reposo relativo y evitar nuevas cargas pesadas",
            listOf(
                "Reposo relativo y evitar nuevas cargas pesadas",
                "Inmovilizar completamente el brazo",
                "Continuar cargando peso para soltar el musculo"
            ),
            "Bien. El dolor aparece tras esfuerzo y conserva movimiento normal.",
            "La mejor respuesta era sobreesfuerzo muscular y reposo relativo."
        ),
        Caso(
            "MEDIO",
            R.drawable.paciente1,
            "Sofia",
            16,
            52f,
            158f,
            "Ardor en la parte alta del abdomen despues de comer, sensacion de llenura, acidez y eructos frecuentes.",
            "Gastritis",
            listOf("Gastritis", "Reflujo gastroesofagico", "Gastroenteritis", "Apendicitis"),
            "Evitar alimentos irritantes y buscar evaluacion si persiste",
            listOf(
                "Evitar alimentos irritantes y buscar evaluacion si persiste",
                "Dejar de comer completamente durante varios dias",
                "Tomar antibioticos sin indicacion"
            ),
            "Correcto. Los sintomas despues de comer orientan a gastritis y requieren cuidado si persisten.",
            "La mejor respuesta era gastritis y evitar irritantes, con evaluacion si persiste."
        ),
        Caso(
            "MEDIO",
            R.drawable.paciente2,
            "Jorge",
            17,
            68f,
            172f,
            "Tos con flema desde hace varios dias, fiebre moderada, cansancio y molestia en el pecho principalmente al toser. Respira normalmente.",
            "Bronquitis",
            listOf("Bronquitis", "Neumonia", "Gripe", "Asma"),
            "Hidratacion, reposo y consulta si empeora o persiste",
            listOf(
                "Hidratacion, reposo y consulta si empeora o persiste",
                "Tomar antibioticos automaticamente",
                "Continuar entrenando intensamente"
            ),
            "Bien. La tos con flema y molestia al toser orientan a bronquitis, con vigilancia si persiste.",
            "La mejor respuesta era bronquitis y consultar si empeora o persiste."
        ),
        Caso(
            "MEDIO",
            R.drawable.paciente3,
            "Valeria",
            14,
            48f,
            157f,
            "Se torcio el tobillo jugando voley. Tiene hinchazon moderada y dolor al caminar, pero todavia puede apoyar parcialmente el pie.",
            "Esguince",
            listOf("Esguince", "Fractura", "Contusion", "Lesion del tendon"),
            "Proteger el tobillo, reposo relativo, frio local y elevacion",
            listOf(
                "Proteger el tobillo, reposo relativo, frio local y elevacion",
                "Seguir jugando para comprobar si mejora",
                "Masajear fuertemente inmediatamente despues de la lesion"
            ),
            "Correcto. La torcedura con apoyo parcial orienta a esguince y cuidado local inicial.",
            "La mejor respuesta era esguince y proteger el tobillo con reposo relativo, frio y elevacion."
        ),
        Caso(
            "MEDIO",
            R.drawable.paciente4,
            "Mateo",
            18,
            70f,
            174f,
            "Cansancio desde hace varias semanas, palidez, mareos al levantarse y menor resistencia durante actividad fisica.",
            "Anemia",
            listOf("Anemia", "Deshidratacion", "Hipotension", "Infeccion viral"),
            "Realizar una evaluacion medica para confirmar la causa",
            listOf(
                "Realizar una evaluacion medica para confirmar la causa",
                "Empezar suplementos por cuenta propia en grandes cantidades",
                "Ignorarlo porque el cansancio siempre es normal"
            ),
            "Correcto. Los sintomas orientan a anemia, pero necesita confirmacion.",
            "La mejor respuesta era anemia y evaluacion medica para confirmar la causa."
        ),
        Caso(
            "MEDIO",
            R.drawable.paciente5,
            "Camila",
            19,
            60f,
            166f,
            "Dolor de oido, sensacion de presion, fiebre leve y disminucion temporal de la audicion despues de varios dias de resfriado.",
            "Otitis media",
            listOf("Otitis media", "Otitis externa", "Sinusitis", "Faringitis"),
            "Buscar evaluacion medica y controlar el dolor de forma apropiada",
            listOf(
                "Buscar evaluacion medica y controlar el dolor de forma apropiada",
                "Introducir objetos en el oido para limpiarlo",
                "Aplicar cualquier medicamento dentro del oido sin evaluacion"
            ),
            "Bien. La presion y disminucion de audicion tras resfriado orientan a otitis media.",
            "La mejor respuesta era otitis media y buscar evaluacion medica."
        ),
        Caso(
            "DIFICIL",
            R.drawable.paciente1,
            "Diego",
            21,
            75f,
            178f,
            "Comenzo con dolor alrededor del ombligo, pero varias horas despues el dolor se concentro en la parte inferior derecha del abdomen. Tiene nauseas, fiebre y poco apetito.",
            "Apendicitis",
            listOf("Apendicitis", "Gastroenteritis", "Gastritis", "Colico renal"),
            "Buscar atencion medica urgente",
            listOf(
                "Buscar atencion medica urgente",
                "Esperar varios dias para comprobar si desaparece",
                "Realizar ejercicio para aliviar el dolor"
            ),
            "Excelente. El dolor que migra y se concentra abajo a la derecha es una pista importante.",
            "La mejor respuesta era apendicitis y buscar atencion medica urgente."
        ),
        Caso(
            "DIFICIL",
            R.drawable.paciente2,
            "Elena",
            22,
            58f,
            164f,
            "Mucha sed durante varias semanas, orina con frecuencia, esta cansada y ha perdido peso aunque sigue comiendo normalmente.",
            "Diabetes",
            listOf("Diabetes", "Deshidratacion", "Hipertiroidismo", "Infeccion urinaria"),
            "Realizar una evaluacion medica y medir glucosa",
            listOf(
                "Realizar una evaluacion medica y medir glucosa",
                "Simplemente beber menos agua",
                "Empezar medicamentos por cuenta propia"
            ),
            "Correcto. Sed, orina frecuente y perdida de peso orientan a diabetes y requieren medicion de glucosa.",
            "La mejor respuesta era diabetes y evaluacion medica con medicion de glucosa."
        ),
        Caso(
            "DIFICIL",
            R.drawable.paciente3,
            "Ruben",
            35,
            82f,
            176f,
            "Despues de correr presenta silbidos al respirar, sensacion de presion en el pecho, tos y dificultad para respirar. Ha tenido episodios similares anteriormente.",
            "Asma",
            listOf("Asma", "Bronquitis", "Reaccion alergica", "Hiperventilacion por ejercicio"),
            "Detener el ejercicio y usar medicacion indicada por profesional",
            listOf(
                "Detener el ejercicio y usar medicacion indicada por profesional",
                "Continuar corriendo hasta que desaparezca",
                "Tomar cualquier medicamento disponible"
            ),
            "Muy bien. Los silbidos y episodios previos orientan a asma; se detiene el ejercicio y se usa solo medicacion indicada.",
            "La mejor respuesta era asma y detener el ejercicio, usando solo medicacion indicada por profesional."
        ),
        Caso(
            "DIFICIL",
            R.drawable.paciente4,
            "Natalia",
            28,
            63f,
            168f,
            "Ardor al orinar, necesidad de ir al baño frecuentemente y molestia en la parte baja del abdomen. No presenta fiebre alta ni dolor en la espalda.",
            "Infeccion urinaria baja",
            listOf("Infeccion urinaria baja", "Infeccion renal", "Calculo renal", "Deshidratacion"),
            "Mantener hidratacion y buscar evaluacion medica",
            listOf(
                "Mantener hidratacion y buscar evaluacion medica",
                "Ignorar los sintomas hasta que aparezca fiebre",
                "Tomar antibioticos sobrantes de otra persona"
            ),
            "Correcto. Los sintomas urinarios sin fiebre alta ni dolor de espalda orientan a infeccion urinaria baja.",
            "La mejor respuesta era infeccion urinaria baja y buscar evaluacion medica."
        ),
        Caso(
            "DIFICIL",
            R.drawable.paciente5,
            "Andres",
            24,
            72f,
            173f,
            "Recibio un golpe fuerte en el brazo. Tiene dolor intenso, hinchazon, dificultad para moverlo y nota que la zona parece estar deformada.",
            "Fractura",
            listOf("Fractura", "Contusion", "Esguince", "Luxacion"),
            "Mantener el brazo inmovil y buscar atencion medica",
            listOf(
                "Mantener el brazo inmovil y buscar atencion medica",
                "Intentar acomodar el hueso manualmente",
                "Mover repetidamente el brazo para comprobar si funciona"
            ),
            "Bien. Dolor intenso, deformidad y dificultad para mover sugieren fractura.",
            "La mejor respuesta era fractura y mantener el brazo inmovil mientras busca atencion medica."
        )
    )
}
