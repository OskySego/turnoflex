import mongoose from 'mongoose';

// ============================================================
// CONEXIÓN A LA BASE DE DATOS
// ============================================================

// Me conecto a la misma instancia de MongoDB que usa todo TurnoFlex (nada de bases separadas).
// OJO: Siempre me aseguro de invocar y ESPERAR connectDB() antes de prender el servidor HTTP.
export const connectDB = async () => {
  
  const uri = String(process.env.MONGO_URI || '').trim();
  
  if (!uri) {
    throw new Error('Falta MONGO_URI. Configurá la conexión de desarrollo en .env (y ni se te ocurra subir ese archivo a GitHub).');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });

    // Muestro solo el host por consola y evito filtrar la URI completa, contraseñas o datos sensibles.
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    
    return conn.connection;

  } catch (error) {
    console.error('❌ No fue posible conectar MongoDB. Revisá que el servicio esté activo y que la MONGO_URI sea correcta.');
    throw error;
  }
};