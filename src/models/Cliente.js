import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    fechaNacimiento: { type: Date, required: true },
    genero: { type: String, required: true },
    telefono: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    direccion: {
        calle: string,
        numero: string,
        localidad: string,
        provincia: string,
    },
    obraSocial: { 
        empresa:string,
        numeroAfiliado: string,
        plan: string,
    }
 }, { timestamps: true });

export const Cliente = mongoose.model('Cliente', clienteSchema);
