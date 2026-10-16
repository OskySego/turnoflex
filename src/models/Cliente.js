import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    fechaNacimiento: { type: Date, required: true },
    genero: { type: String, required: true },
    telefono: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    direccion: {
        calle: String,
        numero: String,
        localidad: String,
        provincia: String,
    },
    obraSocial: { 
        empresa:String,
        numeroAfiliado: String,
        plan: String,
    }
 }, { timestamps: true });

export const Cliente = mongoose.model('Cliente', clienteSchema);
