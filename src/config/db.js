import mongoose from 'mongoose';

// Misma conexión MongoDB utilizada por TurnoFlex: no crea otra base.
// Siempre llamar y ESPERAR connectDB() antes de levantar HTTP.
export const connectDB = async () => {
  const uri = String(process.env.MONGO_URI || '').trim();
  if (!uri) {
    throw new Error('Falta MONGO_URI. Configurá la conexión de desarrollo en .env (no compartas ese archivo).');
  }
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
    // No mostrar la URI, claves ni datos de pacientes en los logs.
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error('❌ No fue posible conectar MongoDB. Revisá que el servicio esté disponible y MONGO_URI sea correcta.');
    throw error;
  }
};