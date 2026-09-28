package com.example.vitalis.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface CasoDao {
    @Query("SELECT * FROM casos ORDER BY id ASC")
    fun obtenerTodos(): List<CasoEntity>

    @Query("SELECT * FROM casos WHERE dificultad = :dificultad ORDER BY id ASC")
    fun obtenerPorDificultad(dificultad: String): List<CasoEntity>

    @Query("SELECT COUNT(*) FROM casos")
    fun contar(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertarTodos(casos: List<CasoEntity>)
}
