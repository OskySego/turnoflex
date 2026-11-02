import mongoose from "mongoose";

const profesionalSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    dni: { type: String, required: true, unique: true },
    genero: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telefono: { type: String, required: true },
    matricula: { type: String, required: true, unique: true },
    especialidad: { type: String, required: true },
    subespecialidad: { type: String, required: true },
    tipoCobertura: { 
        type: String, 
        enum: ['particular', 'obra_social', 'ambas'], 
        default: 'ambas', 
        required: true 
    },
    
    // Días de atención y servicios en formato de texto
    diasAtencion: { type: [String], default: [] },
    diasSobreturnos: { type: [String], default: [] },
    diasTelemedicina: { type: [String], default: [] },

    // Agenda General
    sede: { type: String },
    horaInicio: { type: String, required: true },
    horaFin: { type: String, required: true },
    duracionTurnoMinutos: { type: Number, default: 30 },
    modalidad: { type: String, enum: ['presencial', 'telemedicina', 'ambas'], default: 'presencial' },

    // Configuración de Agenda Sobreturnos
    permiteSobreturnos: { type: Boolean, default: false },
    horaInicioSobreturnos: { type: String },
    horaFinSobreturnos: { type: String },
    cantidadMaximaSobreturnos: { type: Number, max: 8, default: 4 },

    // Configuración de Turnos de telemedicina
    ofreceTelemedicina: { type: Boolean, default: false },
    horaInicioTelemedicina: { type: String },
    horaFinTelemedicina: { type: String },
}, { timestamps: true });

export const Profesional = mongoose.model('Profesional', profesionalSchema);