import express from 'express';
import path from 'path';

import turnoRoutes from './src/routes/turnoRoutes.js';
import profesionalRoutes from './src/routes/profesionalRoutes.js';
import clienteRoutes from './src/routes/clienteRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales de parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración del motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), 'src/views'));

// Página principal
app.get('/', (req, res) => {
  res.render('inicio', {
    tituloPage: 'Inicio - TurnoFlex'
  });
});

// Rutas de la aplicación
app.use('/', turnoRoutes);
app.use('/', profesionalRoutes);
app.use('/', clienteRoutes);

// Manejo genérico de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).send('Página o Endpoint no encontrado');
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log(' Servidor TurnoFlex iniciado');
  console.log(` Inicio: http://localhost:${PORT}`);
  console.log('=================================');
});