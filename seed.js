import mongoose from 'mongoose';
import 'dotenv/config';

import { Cliente } from './src/models/Cliente.js';
import { Profesional } from './src/models/Profesional.js';
import { Turno } from './src/models/Turno.js';

const poblarBaseDeDatos = async () => {
  try {
    // 1. Conectar a MongoDB usando tu variable de entorno[cite: 13]
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB...');

    // 2. Limpiar las colecciones actuales para evitar duplicados[cite: 13]
    await Cliente.deleteMany();
    await Profesional.deleteMany();
    await Turno.deleteMany();
    console.log('🧹 Base de datos limpiada.');

    // 3. Crear Clientes de ejemplo con todos los nuevos campos requeridos
    const clientes = await Cliente.insertMany([
      { 
        nombre: 'Oscar Segovia', 
        dni: '33444555',
        fechaNacimiento: new Date('1989-01-06'),
        genero: 'Masculino',
        email: 'oscar@ejemplo.com', 
        telefono: '1155443322',
        domicilio: { 
          calle: 'Av. Rivadavia', 
          numero: '1234', 
          localidad: 'Morón', 
          provincia: 'Buenos Aires' 
        },
        obraSocial: { 
          empresa: 'OSDE', 
          numeroAfiliado: '12345678', 
          plan: '310' 
        }
      },
      { 
        nombre: 'Valeria Román', 
        dni: '35666777',
        fechaNacimiento: new Date('1992-05-14'),
        genero: 'Femenino',
        email: 'valeria@ejemplo.com', 
        telefono: '1122334455',
        domicilio: { 
          calle: 'San Martín', 
          numero: '456', 
          localidad: 'La Matanza', 
          provincia: 'Buenos Aires' 
        },
        obraSocial: { 
          empresa: '', 
          numeroAfiliado: '', 
          plan: '' 
        } // Ejemplo de atención particular
      },
      { 
        nombre: 'Martín Pérez', 
        dni: '28999888',
        fechaNacimiento: new Date('1980-11-20'),
        genero: 'Masculino',
        email: 'martin@ejemplo.com', 
        telefono: '1199887766',
        domicilio: { 
          calle: 'Belgrano', 
          numero: '789', 
          localidad: 'Morón', 
          provincia: 'Buenos Aires' 
        },
        obraSocial: { 
          empresa: 'Swiss Medical', 
          numeroAfiliado: '98765432', 
          plan: 'SM20' 
        }
      }
    ]);

    // 4. Crear Profesionales de ejemplo[cite: 13]
    const profesionales = await Profesional.insertMany([
  {
    nombre: "Dra. María Gómez",
    dni: "25412365",
    genero: "Femenino",
    email: "maria.gomez@turnoflex.com",
    telefono: "1144556677",
    matricula: "MN 45892",
    especialidad: "Clínica Médica",
    subespecialidades: "Medicina Preventiva",
    tipoCobertura: "obra_social", // Solo Obra Social
    sede: "Sede Central - Consultorio 2",
    diasDisponibles: [1, 2, 3, 4, 5],
    horaInicio: "08:00",
    horaFin: "14:00",
    duracionTurnoMinutos: 30,
    modalidad: "presencial",
    permiteSobreturnos: false, // Sin sobreturnos
    diasSobreturnos: [],
    ofreceTelemedicina: false
  },
  {
    nombre: "Dr. Roberto Sánchez",
    dni: "20111222",
    genero: "Masculino",
    email: "roberto.sanchez@turnoflex.com",
    telefono: "1166778899",
    matricula: "MN 55412",
    especialidad: "Clínica Médica",
    subespecialidades: "Geriatría",
    tipoCobertura: "ambas", // Atiende ambas (particular y obra social)
    sede: "Sede Central - Consultorio 5",
    diasDisponibles: [1, 3, 5],
    horaInicio: "09:00",
    horaFin: "15:00",
    duracionTurnoMinutos: 30,
    modalidad: "ambas",
    permiteSobreturnos: true, // Con sobreturnos habilitados
    diasSobreturnos: [1, 3],
    horaInicioSobreturnos: "14:00",
    horaFinSobreturnos: "15:00",
    cantidadMaximaSobreturnos: 4,
    ofreceTelemedicina: true, // Telemedicina habilitada (20 min)
    diasTelemedicina: [5],
    horaInicioTelemedicina: "16:00",
    horaFinTelemedicina: "18:00"
  },
  {
    nombre: "Dr. Carlos Pérez",
    dni: "22896321",
    genero: "Masculino",
    email: "carlos.perez@turnoflex.com",
    telefono: "1199887766",
    matricula: "MN 78910",
    especialidad: "Cardiología",
    subespecialidades: "Electrocardiografía",
    tipoCobertura: "particular", // Solo particular
    sede: "Sede Norte - Consultorio 4",
    diasDisponibles: [2, 4],
    horaInicio: "10:00",
    horaFin: "16:00",
    duracionTurnoMinutos: 20,
    modalidad: "presencial",
    permiteSobreturnos: true,
    diasSobreturnos: [2],
    horaInicioSobreturnos: "15:00",
    horaFinSobreturnos: "16:00",
    cantidadMaximaSobreturnos: 3,
    ofreceTelemedicina: false
  },
  {
    nombre: "Dra. Lucía Fernández",
    dni: "27333444",
    genero: "Femenino",
    email: "lucia.fernandez@turnoflex.com",
    telefono: "1122334455",
    matricula: "MN 99887",
    especialidad: "Pediatría",
    subespecialidades: "Puericultura",
    tipoCobertura: "ambas",
    sede: "Sede Oeste - Consultorio 1",
    diasDisponibles: [1, 2, 3, 4, 5],
    horaInicio: "08:30",
    horaFin: "13:30",
    duracionTurnoMinutos: 30,
    modalidad: "presencial",
    permiteSobreturnos: true,
    diasSobreturnos: [3],
    horaInicioSobreturnos: "13:00",
    horaFinSobreturnos: "13:30",
    cantidadMaximaSobreturnos: 2,
    ofreceTelemedicina: true,
    diasTelemedicina: [2, 4],
    horaInicioTelemedicina: "14:00",
    horaFinTelemedicina: "16:00"
  },
  {
    nombre: "Dr. Esteban Quito",
    dni: "29555666",
    genero: "Masculino",
    email: "esteban.quito@turnoflex.com",
    telefono: "1177889900",
    matricula: "MN 33221",
    especialidad: "Dermatología",
    subespecialidades: "Estética",
    tipoCobertura: "particular",
    sede: "Sede Sur - Consultorio 3",
    diasDisponibles: [3, 4, 5],
    horaInicio: "13:00",
    horaFin: "19:00",
    duracionTurnoMinutos: 30,
    modalidad: "ambas",
    permiteSobreturnos: false,
    ofreceTelemedicina: false
  }
]);

    // 5. Crear Turnos vinculando los IDs reales de MongoDB[cite: 13]
    await Turno.insertMany([
  {
    cliente_id: clientes[0]._id, 
    profesional_id: profesionales[0]._id, // Dra. María Gómez (Atiende solo Obra Social)
    fecha: '2026-10-15', // (Jueves - Día disponible para ella)
    hora: '09:30',
    estado: 'reservado'
  },
  {
    cliente_id: clientes[1]._id,
    profesional_id: profesionales[1]._id, // Dr. Roberto Sánchez (Atiende Ambas)
    fecha: '2026-10-16', // (Viernes - Día disponible para él)
    hora: '14:00',
    estado: 'atendido'
  }
]);

    console.log('🌱 ¡Datos de prueba inyectados con éxito!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error al poblar la base de datos:', error);
    process.exit(1);
  }
};

poblarBaseDeDatos();