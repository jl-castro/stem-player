package com.example.vitalis

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.example.vitalis.data.AppDatabase
import com.example.vitalis.data.CasosRoomRepository
import com.example.vitalis.data.ProgresoRepository
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomPersistenceTest {

    private lateinit var db: AppDatabase
    private lateinit var casosRepository: CasosRoomRepository
    private lateinit var progresoRepository: ProgresoRepository

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        casosRepository = CasosRoomRepository(db.casoDao())
        progresoRepository = ProgresoRepository(db.progresoDao())
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun inicializaQuinceCasosSinDuplicar() {
        casosRepository.inicializarSiEstaVacio()
        casosRepository.inicializarSiEstaVacio()

        assertEquals(15, casosRepository.contar())
    }

    @Test
    fun obtieneCincoCasosPorCadaDificultad() {
        casosRepository.inicializarSiEstaVacio()

        assertEquals(5, db.casoDao().obtenerPorDificultad("FACIL").size)
        assertEquals(5, db.casoDao().obtenerPorDificultad("MEDIO").size)
        assertEquals(5, db.casoDao().obtenerPorDificultad("DIFICIL").size)
    }

    @Test
    fun guardaYRecuperaProgreso() {
        progresoRepository.guardar(
            puntos = 210,
            casoActual = 5,
            diagnosticosCorrectos = 4,
            accionesCorrectas = 5,
            checkpoint = GameLogic.crearCheckpoint(210, 4, 5),
            nivelInicioActual = 5,
            partidaFinalizada = false
        )

        val progreso = progresoRepository.obtener()

        assertEquals(210, progreso?.puntosTotales)
        assertEquals(GameLogic.calcularRango(210), progreso?.rangoActual)
        assertEquals("MEDIO", progreso?.nivelActual)
        assertEquals(5, progreso?.casoActual)
        assertEquals(4, progreso?.diagnosticosCorrectos)
        assertEquals(5, progreso?.accionesCorrectas)
    }

    @Test
    fun reiniciaProgreso() {
        progresoRepository.guardar(
            puntos = 210,
            casoActual = 5,
            diagnosticosCorrectos = 4,
            accionesCorrectas = 5,
            checkpoint = GameLogic.crearCheckpoint(210, 4, 5),
            nivelInicioActual = 5,
            partidaFinalizada = false
        )

        progresoRepository.reiniciar()

        assertNull(progresoRepository.obtener())
    }

    @Test
    fun conservaCheckpointParaReintentoDeNivel() {
        val checkpointMedio = GameLogic.crearCheckpoint(210, 4, 5)

        progresoRepository.guardar(
            puntos = 360,
            casoActual = 9,
            diagnosticosCorrectos = 7,
            accionesCorrectas = 8,
            checkpoint = checkpointMedio,
            nivelInicioActual = 5,
            partidaFinalizada = false
        )

        val progreso = progresoRepository.obtener()

        assertEquals(360, progreso?.puntosTotales)
        assertEquals(210, progreso?.checkpointPuntosNivel)
        assertEquals(4, progreso?.checkpointDiagnosticos)
        assertEquals(5, progreso?.checkpointAcciones)
        assertEquals(5, progreso?.nivelInicioActual)
    }
}
