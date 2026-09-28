package com.example.vitalis.data

import com.example.vitalis.Caso
import com.example.vitalis.CasosRepository

class CasosRoomRepository(private val casoDao: CasoDao) {
    fun inicializarSiEstaVacio() {
        if (casoDao.contar() == 0) {
            val seed = CasosRepository.obtenerCasos().mapIndexed { index, caso ->
                caso.toEntity(index + 1)
            }
            casoDao.insertarTodos(seed)
        }
    }

    fun obtenerCasos(): List<Caso> {
        inicializarSiEstaVacio()
        return casoDao.obtenerTodos().map { it.toCaso() }
    }

    fun contar(): Int = casoDao.contar()
}
