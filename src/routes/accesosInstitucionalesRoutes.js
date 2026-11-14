import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asegurarAutenticacion, permitirRoles } from '../middlewares/authMiddleware.js';
import { AccesosInstitucionalesController as C } from '../controllers/accesosInstitucionalesController.js';

const router = Router();
const limiteActivaciones = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/secretarias/nueva', asegurarAutenticacion, permitirRoles('admin'), C.nuevaSecretaria);
router.post('/secretarias', asegurarAutenticacion, permitirRoles('admin'), C.crearSecretaria);
router.get('/activar/:token', limiteActivaciones, C.verActivacion);
router.post('/activar/:token', limiteActivaciones, C.activar);
router.post('/reenviar/:id', asegurarAutenticacion, permitirRoles('admin', 'personal'), C.reenviar);

export default router;