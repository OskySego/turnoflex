import { Router } from 'express';
import { ClienteController } from '../controllers/clienteController.js';
import {
  validarExistenciaCliente,
  validarCamposCreacionCliente
} from '../middlewares/clienteMiddleware.js';

const router = Router();

// 1. GET /clientes -> Lista de clientes
router.get('/', ClienteController.getClientes);

// 2. GET /clientes/nuevo -> Muestra el formulario (¡OBLIGATORIO antes de /:id!)
router.get('/nuevo', (req, res) => {
  res.render('nuevo-cliente', { tituloPage: 'Nuevo Cliente' });
});

// 3. POST /clientes -> Crea el cliente procesando el formulario
router.post('/', validarCamposCreacionCliente, ClienteController.crearCliente);

// 4. GET /clientes/:id -> Detalle del cliente (Siempre debe ir al final)
router.get('/:id', validarExistenciaCliente, ClienteController.getDetalleCliente);

export default router;