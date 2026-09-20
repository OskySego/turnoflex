import { Router } from 'express';
import { ClienteController } from '../controllers/clienteController.js';
import {
  validarExistenciaCliente,
  validarCamposCreacionCliente,
  validarCamposActualizacionCliente
} from '../middlewares/clienteMiddleware.js';

const router = Router();

//  RUTAS API (JSON) 
router.get('/clientes', ClienteController.getAll);
router.get('/clientes/:id', validarExistenciaCliente, ClienteController.getById);
router.post('/clientes', validarCamposCreacionCliente, ClienteController.create);
router.put('/clientes/:id', validarExistenciaCliente, validarCamposActualizacionCliente, ClienteController.update);
router.delete('/clientes/:id', validarExistenciaCliente, ClienteController.delete);

//  RUTAS VISTAS (HTML) 
router.get('/vista/clientes', ClienteController.getAllVista);
router.get('/vista/clientes/:id', validarExistenciaCliente, ClienteController.getByIdVista);

export default router;