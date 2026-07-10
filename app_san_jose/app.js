// importación de librerías
import express from 'express';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// importaciones de rutas
import loginRoutes from './routes/login.js';
import encuestasRouter from './routes/encuestas.js';
import estadisticasRouter from './routes/estadisticas.js';
import usuariosRouter from './routes/usuarios.js';
import { verificarSesion } from './middleware/sesions.js';
import { verificarRol } from './middleware/roles.js';
import iaRouter from './routes/ia.js';
import reportesRouter from "./routes/reportesPDF.js";

// Config
dotenv.config();
const app = express();

// Para poder usar __dirname con ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// configuración de sesiones
app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET || "clave1234",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // secure: true, // cámbiarlo a true si se usa HTTPS
    // sameSite: "lax", // "none" si se usa el frontend en otro dominio con HTTPS y lax si es el mismo dominio
    secure: process.env.NODE_ENV === "production", 
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 7 // 7 horas
  }
}));

// Evitar cache
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Servir frontend edn la carpeta public
app.use(express.static(path.join(__dirname, "public")));


// Rutas API
app.use('/api/login', loginRoutes);
app.use('/api/encuestas', encuestasRouter);
app.use('/api/estadisticas', estadisticasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api', iaRouter);
app.use("/api/reportes", reportesRouter);


// Redirecciones a páginas
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get('/administrador', verificarRol('administrador'), (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","administrador.html"));
});
app.get('/administrador_analisis', verificarRol('administrador'), (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","administrador_analisis.html"));
});
app.get('/administrador_create', verificarRol('administrador'), (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","administrador_create.html"));
});
app.get('/administrador_update', verificarRol('administrador'), (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","administrador_update.html"));
});
app.get('/administrador_deactivation', verificarRol('administrador'), (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","administrador_deactivation.html"));
});
app.get('/area_colaborador', verificarSesion, (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","area_colaborador.html"));
});
app.get('/encuesta', (req, res) => {
  res.sendFile(path.join(__dirname, "public","pages","encuesta.html"));
});


// Middleware para rutas no encontradas en API
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "public", "pages", "404.html"));
});

// servidor
const puerto = process.env.PORT;
app.listen(puerto, () => {
  console.log(`Servidor corriendo en http://localhost:${puerto}`);
});
