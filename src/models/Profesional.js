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

    // Agenda General
    sede: { type: String},
    diasDisponibles: [{ type: String, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] }],
    horaInicio: { type: String, required: true },
    horaFin: { type: String, required: true },
    duracionTurnoMinutos: { type: Number, default: 30 },
    modalidad: { type: String, enum: ['presencial', 'telemedicina', 'ambas'], default: 'presencial' },

    // Nueva Configuración de Agenda Sobreturnos (maximos 8, duración 20 minutos)
    permiteSobreturnos: { type: Boolean, default: false },
    diasSobreturnos: [{ type: String, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] }],
    horaInicioSobreturnos: { type: String },
    horaFinSobreturnos: { type: String },
    cantidadMaximaSobreturnos: { type: Number, max: 8, default: 4 },

    // Configuración de Turnos de telemedicina (duracion fija de 20 min y dias/horarios especificos)
    ofreceTelemedicina: { type: Boolean, default: false },
    diasTelemedicina: [{ type: String, enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] }],
    horaInicioTelemedicina: { type: String },
    horaFinTelemedicina: { type: String },
}, {timestamps: true});

export const Profesional = mongoose.model('Profesional', profesionalSchema);