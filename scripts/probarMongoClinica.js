import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

// Lectura sola: consulta ping, no crea ni actualiza pacientes, turnos ni historias.
if (process.env.NODE_ENV === 'production') {
  console.error('No ejecutar la prueba de conexión clínica en producción.');
  process.exitCode = 1;
} else {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    console.log('✅ Ping MongoDB correcto. Base:', mongoose.connection.name);
  } catch {
    console.error('❌ No se pudo realizar el ping. Revisá MongoDB local o Atlas y tu .env (sin compartirlo).');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
