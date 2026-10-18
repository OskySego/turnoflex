import { Profesional } from '../models/Profesional.js';

export class ProfesionalController {

  // Listar profesionales
  static async getProfesionales(req, res) {
    try {
      const profesionales = await Profesional.find().lean({ virtuals: true });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: profesionales });
      }

      // VISTA EXACTA SEGÚN TU ESTRUCTURA: profesionales.pug
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
      
      // Buscamos en MongoDB usando Mongoose
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

      // Asegurate de que el nombre de la vista ('detalle-profesional') 
      // coincida con el nombre de tu archivo .pug
      res.render('detalle-profesional', {
        tituloPage: `Detalle de ${profesional.nombre}`,
        profesional
      });
    } catch (error) {
      // Si el ID no tiene el formato correcto de Mongo, caerá en este catch
      res.status(500).send('Error al obtener el detalle: ' + error.message);
    }
  }

  // Crear profesional
  static async crearProfesional(req, res) {
    try {
      const { 
        nombre, dni, genero, email, telefono,
        matricula, especialidad, subespecialidades, tipoCobertura,
        sede, diasDisponibles, horaInicio, horaFin, duracionTurnoMinutos, modalidad,
        permiteSobreturnos, diasSobreturnos, horaInicioSobreturnos, horaFinSobreturnos, cantidadMaximaSobreturnos,
        ofreceTelemedicina, diasTelemedicina, horaInicioTelemedicina, horaFinTelemedicina
      } = req.body;

      const parseArrayNumbers = (arr) => {
        if (!arr) return [];
        return Array.isArray(arr) ? arr.map(Number) : String(arr).split(',').map(Number);
      };

      const nuevoProfesional = await Profesional.create({
        nombre, dni, genero, email, telefono,
        matricula, especialidad, subespecialidades, tipoCobertura,
        sede,
        diasDisponibles: parseArrayNumbers(diasDisponibles),
        horaInicio: horaInicio || '08:00',
        horaFin: horaFin || '18:00',
        duracionTurnoMinutos: Number(duracionTurnoMinutos) || 30,
        modalidad,
        permiteSobreturnos: permiteSobreturnos === 'on' || permiteSobreturnos === true,
        diasSobreturnos: parseArrayNumbers(diasSobreturnos),
        horaInicioSobreturnos,
        horaFinSobreturnos,
        cantidadMaximaSobreturnos: Math.min(Number(cantidadMaximaSobreturnos) || 4, 8), // Límite estricto de 8
        ofreceTelemedicina: ofreceTelemedicina === 'on' || ofreceTelemedicina === true,
        diasTelemedicina: parseArrayNumbers(diasTelemedicina),
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