import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  dni: { type: String, required: true },
  fechaNacimiento: { type: Date },
  genero: { type: String },
  telefono: { type: String, required: true },
  email: { type: String, required: true },
  domicilio: {
    calle: String,
    numero: String,
    localidad: String,
    provincia: String
  },
  obraSocial: {
    empresa: String,
    numeroAfiliado: String,
    plan: String
  },
  // Para agregar el grupo familiar a un cliente 
  grupoFamiliar: [{   
    nombre: { type: String, required: true },
    dni: { type: String, required: true },
    parentesco: { type: String, required: true }
  }]

},  { timestamps: true });

export const Cliente = mongoose.model('Cliente', clienteSchema);