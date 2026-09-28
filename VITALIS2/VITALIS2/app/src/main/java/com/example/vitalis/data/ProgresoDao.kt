package com.example.vitalis.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ProgresoDao {
    @Query("SELECT * FROM progreso WHERE id = 1")
    fun obtener(): ProgresoEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun guardar(progreso: ProgresoEntity)

    @Query("DELETE FROM progreso")
    fun reiniciar()
}
