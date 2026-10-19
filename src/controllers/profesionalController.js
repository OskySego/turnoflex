import { Profesional } from '../models/Profesional.js';

export class ProfesionalController {

  // Listar profesionales
  static async getProfesionales(req, res) {
    try {
      const profesionales = await Profesional.find().lean({ virtuals: true });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: profesionales });
      }

      res.render('profesionales', {
        tituloPage: 'Listado de Profesionales',
        profesionales: profesionales || []
      });
    } catch (error) {
      res.status(500).send('Error al obtener profesionales: ' + error.message);
    }
  }

  
  // Detalle de un profesional por ID
  static async getDetalleProfesional(req, res) {
    try {
      const { id } = req.params;
      
      const profesional = await Profesional.findById(id).lean({ virtuals: true });

      if (!profesional) {
        return res.status(404).render('detalle-profesional', {
          tituloPage: 'No Encontrado',
          error: `El profesional con ID '${id}' no fue encontrado en el sistema.`
        });
      }

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: profesional });
      }

      res.render('detalle-profesional', {
        tituloPage: `Detalle de ${profesional.nombre}`,
        profesional
      });
    } catch (error) {
      res.status(500).send('Error al obtener el detalle: ' + error.message);
    }
  }

  // Crear profesional
  static async crearProfesional(req, res) {
    try {
      const { 
        nombre, dni, genero, email, telefono,
        matricula, especialidad, subespecialidades, tipoCobertura,
        sede, diasAtencion, horaInicio, horaFin, duracionTurnoMinutos, modalidad,
        permiteSobreturnos, diasSobreturnos, horaInicioSobreturnos, horaFinSobreturnos, cantidadMaximaSobreturnos,
        ofreceTelemedicina, diasTelemedicina, horaInicioTelemedicina, horaFinTelemedicina
      } = req.body;

      // NUEVO: Función que asegura que los días sean listas de textos (Arrays) sin romper las palabras
      const parseArrayStrings = (arr) => {
        if (!arr) return [];
        return Array.isArray(arr) ? arr : [arr];
      };

      const nuevoProfesional = await Profesional.create({
        nombre, dni, genero, email, telefono,
        matricula, especialidad, subespecialidades, tipoCobertura,
        sede,
        diasAtencion: parseArrayStrings(diasAtencion), // <-- Nombre corregido
        horaInicio: horaInicio || '08:00',
        horaFin: horaFin || '18:00',
        duracionTurnoMinutos: Number(duracionTurnoMinutos) || 30,
        modalidad,
        permiteSobreturnos: permiteSobreturnos === 'on' || permiteSobreturnos === true,
        diasSobreturnos: parseArrayStrings(diasSobreturnos),
        horaInicioSobreturnos,
        horaFinSobreturnos,
        cantidadMaximaSobreturnos: Math.min(Number(cantidadMaximaSobreturnos) || 4, 8),
        ofreceTelemedicina: ofreceTelemedicina === 'on' || ofreceTelemedicina === true,
        diasTelemedicina: parseArrayStrings(diasTelemedicina),
        horaInicioTelemedicina,
        horaFinTelemedicina
      });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(201).json({ status: 'success', data: nuevoProfesional });
      }

      res.redirect('/profesionales');
    } catch (error) {
      res.status(400).send('Error al crear profesional: ' + error.message);
    }
  }
}

export default ProfesionalController;