import { Router } from 'express';
import db from './db.js';
import bcrypt from 'bcrypt';

const loginRoutes = Router();

// Iniciar sesión
loginRoutes.post('/', async (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ ok: false, error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    // 1. Buscar el usuario en la DB
    const [rows] = await db.query(`
      SELECT u.usuario, u.contrasena, r.nombre_rol AS rol, u.cedula
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.usuario = ?
    `, [usuario]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas.' });
    }

    const usuarioEncontrado = rows[0];

    // 2. Validar contraseña
    const passwordOk = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena);
    if (!passwordOk) {
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas.' });
    }

    // 3. Guardar usuario en la sesión (sin contraseña)
    req.session.user = {
      cedula: usuarioEncontrado.cedula,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol
    };

    // 4. Responder
    return res.status(200).json({
      ok: true,
      message: 'Inicio de sesión exitoso.',
      usuario: {
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol
      }
    });
  } catch (error) {
    console.error('Error en la consulta:', error);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
});

// Endpoint para saber si hay sesión activa
loginRoutes.get("/me", (req, res) => {
  if (req.session.user) {
    return res.json(req.session.user);
  }
  return res.status(401).json({ error: "No hay sesión activa" });
});

// Cerrar sesión
loginRoutes.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Error cerrando sesión:", err);
      return res.status(500).json({ error: "Error cerrando sesión" });
    }
    res.clearCookie("connect.sid"); // borra cookie de sesión
    res.json({ ok: true, message: "Sesión cerrada" });
  });
});

export default loginRoutes;
