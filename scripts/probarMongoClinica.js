/**
 * Test rápido de conexión a MongoDB (Local / Atlas).
 * Solo hace un ping de lectura, sin alterar colecciones de pacientes o turnos.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

// Blindaje: por las dudas evitamos correr scripts de prueba en producción
if (process.env.NODE_ENV === 'production') {
  console.error('No ejecutar la prueba de conexión clínica en producción.');
  process.exitCode = 1;
} else {
  try {
    // Intentamos levantar la conexión y verificar respuesta del servidor
    await connectDB();
    await mongoose.connection.db.admin().ping();
    console.log('✅ Ping MongoDB correcto. Base:', mongoose.connection.name);
  } catch {
    console.error('❌ No se pudo realizar el ping. Revisá MongoDB local o Atlas y tu .env (sin compartirlo).');
    process.exitCode = 1;
  } finally {
    // Desconectamos limpiamente para que el proceso no quede colgado en la terminal
    await mongoose.disconnect().catch(() => {});
  }
}