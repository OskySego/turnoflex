import { ClienteModel } from '../models/ClienteModel.js';

const clienteModel = new ClienteModel();

/**
 * Verifica si el cliente existe segun id
 */
export const validarExistenciaCliente = (req, res, next) => {
  const { id } = req.params;
  const cliente = clienteModel.findById(id);

  if (!cliente) {
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: `El cliente con ID '${id}' no fue encontrado en el sistema.`
      });
    }
    return res.status(404).render('detalle-cliente', {
      tituloPage: 'Cliente no encontrado',
      error: `El cliente con ID "${id}" no existe en la base de datos.`
    });
  }

  req.clienteEncontrado = cliente;
  next();
};

/**
 * Verifica que se completaron los campos obligatorios
 */
export const validarCamposCreacionCliente = (req, res, next) => {
  const { nombre, email } = req.body;
  const camposFaltantes = [];

  if (!nombre) camposFaltantes.push('nombre');
  if (!email) camposFaltantes.push('email');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      status: 'fail',
      code: 400,
      message: 'Faltan campos obligatorios en el cuerpo de la solicitud.',
      camposFaltantes
    });
  }

  next();
};

/**
 * Valida la presencia de campos al actualizar un cliente.
 */
export const validarCamposActualizacionCliente = (req, res, next) => {
  const { nombre, email, telefono } = req.body;
  
  // Al menos un campo debe venir
  if (!nombre && !email && !telefono) {
    return res.status(400).json({
      status: 'fail',
      code: 400,
      message: 'Debe enviar al menos un campo para actualizar.'
    });
  }

  next();
};