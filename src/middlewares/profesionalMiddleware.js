// ✅ Importamos mongoose para validar el formato de ID de MongoDB
import mongoose from 'mongoose';
// ✅ Importamos tu modelo Mongoose real
import { Profesional } from '../models/Profesional.js'; 

/**
 * Middleware que verifica si un profesional existe en MongoDB.
 * Y si no, renderiza una vista en lugar de devolver JSON.
 */
export const validarExistenciaProfesional = async (req, res, next) => {
  const { id } = req.params;

  try {
    // 1. Validar que el ID sea un ObjectId válido de Mongoose
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).render('detalle-profesional', {
        tituloPage: 'Error 400',
        error: 'El formato del ID de profesional no es válido.'
      });
    }

    // 2. Buscar en MongoDB usando await
    const profesional = await Profesional.findById(id).lean({ virtuals: true });

    // 3. Si no existe, mostrar la página de error
    if (!profesional) {
      return res.status(404).render('detalle-profesional', {
        tituloPage: 'No Encontrado',
        error: `El profesional con ID '${id}' no fue encontrado en la base de datos.`
      });
    }

    // Opcional: adjuntarlo al req por si el controller lo necesita
    req.profesionalEncontrado = profesional;

    next();
  } catch (error) {
    console.error("Error en el middleware validarExistenciaProfesional:", error);
    res.status(500).send('Error interno en el servidor.');
  }
};

/**
 * Middleware que valida los campos obligatorios
 * ANTES de crear un profesional (adaptado a tu nuevo Esquema).
 */
export const validarCamposCreacionProfesional = (req, res, next) => {
  // ✅ Usamos los nombres correctos que espera tu controlador y Mongoose
  const {
    nombre,
    especialidad,
    diasDisponibles // ahora en camelCase y son números, como definimos en Mongoose
  } = req.body;

  const camposFaltantes = [];

  if (!nombre) camposFaltantes.push('nombre');
  if (!especialidad) camposFaltantes.push('especialidad');
  // Quitamos la obligatoriedad estricta de horaInicio y horaFin porque Mongoose les pone default

  if (camposFaltantes.length > 0) {
    // Para el formulario de creación, podés devolver a la vista o dejar el JSON 
    // dependiendo de cómo manejes el envío del form.
    return res.status(400).send(`Error: Faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
  }

  // Verificamos si mandaron días, que sea un array o un string separable
  if (diasDisponibles && typeof diasDisponibles !== 'string' && !Array.isArray(diasDisponibles)) {
    return res.status(400).send('Error: diasDisponibles tiene un formato incorrecto.');
  }

  next();
};