import { ClienteModel } from '../models/ClienteModel.js';

const clienteModel = new ClienteModel();

export class ClienteController {
  // GET /clientes - Listar todos (JSON)
  static getAll(req, res) {
    try {
      const clientes = clienteModel.findAll();
      res.status(200).json({ status: 'success', data: clientes });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // GET /clientes/:id - Obtener uno (JSON)
  static getById(req, res) {
    try {
      // El middleware ya verificó que existe y lo adjuntó a req
      res.status(200).json({ status: 'success', data: req.clienteEncontrado });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // POST /clientes - Crear (JSON)
  static create(req, res) {
    try {
      // El middleware ya validó los campos
      const nuevo = clienteModel.create(req.body);
      res.status(201).json({ status: 'success', data: nuevo });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // PUT /clientes/:id - Actualizar (JSON)
  static update(req, res) {
    try {
      // El middleware ya verificó que existe
      const actualizado = clienteModel.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: actualizado });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // DELETE /clientes/:id - Eliminar (JSON)
  static delete(req, res) {
    try {
      // El middleware ya verificó que existe
      clienteModel.delete(req.params.id);
      res.status(200).json({ status: 'success', message: 'Cliente eliminado correctamente.' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Vista HTML

  // GET /vista/clientes - Listar (HTML)
  static getAllVista(req, res) {
    try {
      const clientes = clienteModel.findAll();
      res.render('lista-cliente', {
        tituloPage: 'Clientes',
        clientes
      });
    } catch (error) {
      res.status(500).render('lista-cliente', {
        tituloPage: 'Error',
        error: error.message
      });
    }
  }

  // GET /vista/clientes/:id - Detalle (HTML)
  static getByIdVista(req, res) {
    try {
      res.render('detalle-cliente', {
        tituloPage: `Detalle del Cliente #${req.clienteEncontrado.id}`,
        cliente: req.clienteEncontrado
      });
    } catch (error) {
      res.status(500).render('detalle-cliente', {
        tituloPage: 'Error',
        error: error.message
      });
    }
  }
}