package com.example.vitalis.data

import androidx.room.TypeConverter

class StringListConverters {
    @TypeConverter
    fun fromString(value: String): List<String> {
        if (value.isBlank()) return emptyList()
        return value.split(SEPARATOR)
    }

    @TypeConverter
    fun fromList(value: List<String>): String {
        return value.joinToString(SEPARATOR)
    }

    private companion object {
        private const val SEPARATOR = "\u001F"
    }
}
