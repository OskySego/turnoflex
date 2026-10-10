import mongoose from "mongoose";

const turnoSchema = new mongoose.Schema(
  {
    cliente_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true
    },
    profesional_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profesional',
      required: true
    },
    fecha: { 
      type: String, 
      required: true 
    },
    hora: { 
      type: String, 
      required: true 
    },
    estado: {
      type: String,
      enum: ['reservado', 'atendido', 'cancelado'],
      default: 'reservado'
    }
  },
  { timestamps: true }
  
);

export const Turno = mongoose.model('Turno', turnoSchema);
export default Turno;