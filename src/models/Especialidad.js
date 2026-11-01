import mongoose from 'mongoose';

const especialidadSchema = new mongoose.Schema({
  nombre: { 
    type: String, 
    required: true, 
    unique: true 
  },
  precioParticular: { 
    type: Number, 
    required: true 
  },
  copagoObraSocial: { 
    type: Number, 
    required: true 
  },
  montoSena: { 
    type: Number, 
    required: true 
  },
  activa: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export const Especialidad = mongoose.model('Especialidad', especialidadSchema);