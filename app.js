import express from 'express';
import path from 'path';
import turnoRoutes from './src/routes/turnoRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración del motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), 'src/views'));

// Rutas de la aplicación
app.use('/', turnoRoutes);

// Manejo genérico de rutas no encontradas (404)
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), 'src/views'));

app.use('/', turnoRoutes);

app.use((req, res) => {
  res.status(404).send('Página o Endpoint no encontrado');
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log(' Servidor TurnoFlex iniciado');
  console.log(` Accedé en: http://localhost:${PORT}/turnos/trn-301`);
  console.log('=================================');
});