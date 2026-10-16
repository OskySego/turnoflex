import { Cliente } from '../models/Cliente.js';

export class ClienteController {
  
  // 1. Obtener y listar clientes
  static async getClientes(req, res) {
    try {
      const clientes = await Cliente.find().lean({ virtuals: true });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: clientes });
      }

      res.render('lista-cliente', {
        tituloPage: 'Listado de Clientes',
        clientes: clientes || []
      });
    } catch (error) {
      res.status(500).send('Error al obtener clientes: ' + error.message);
    }
  }

  // 2. Detalle de un cliente por ID
  static async getDetalleCliente(req, res) {
    try {
      const { id } = req.params;
      const cliente = await Cliente.findById(id).lean({ virtuals: true });

      if (!cliente) {
        return res.status(404).render('detalle-cliente', {
          tituloPage: 'No Encontrado',
          error: 'Cliente no encontrado'
        });
      }

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({ status: 'success', data: cliente });
      }

      res.render('detalle-cliente', {
        tituloPage: `Detalle de ${cliente.nombre}`,
        cliente
      });
    } catch (error) {
      res.status(500).send('Error al obtener el detalle: ' + error.message);
    }
  }

  // 3. Crear un nuevo cliente
  static async crearCliente(req, res) {
    try {
      const { 
        nombre, dni, fechaNacimiento, genero, 
        telefono, email, calle, numero, localidad, provincia, 
        empresa, numeroAfiliado, plan 
      } = req.body;

      const nuevoCliente = await Cliente.create({
        nombre,
        dni,
        fechaNacimiento,
        genero,
        telefono,
        email,
        domicilio: { calle, numero, localidad, provincia },
        obraSocial: { empresa, numeroAfiliado, plan }
      });

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(201).json({ status: 'success', data: nuevoCliente });
      }

      res.redirect('/clientes');
    } catch (error) {
      res.status(400).send('Error al crear cliente: ' + error.message);
    }
  }
}

export default ClienteController;