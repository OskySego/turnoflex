import mongoose from 'mongoose';

const historiaClinicaSchema = new mongoose.Schema({
  cliente_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Cliente', 
    required: true 
  },
  profesional_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  turno_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Turno' 
  },
  fecha: { 
    type: Date, 
    default: Date.now 
  },
  motivoConsulta: { 
    type: String, 
    required: true 
  },
  evolucion: { 
    type: String, 
    required: true 
  },
  diagnostico: { 
    type: String, 
    required: true 
  },
  archivosAdjuntos: [{ 
    nombreArchivo: String, 
    url: String 
  }]
}, { timestamps: true });

export const HistoriaClinica = mongoose.model('HistoriaClinica', historiaClinicaSchema);