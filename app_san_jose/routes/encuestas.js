import express from 'express';
import db from './db.js';

const encuestasRouter = express.Router();


encuestasRouter.post('/', async (req, res) => {
  const {
    area_atencion,
    atendido_por,
    fecha,
    puntualidad,
    trato,
    resolucion,
    comentario,
    id_motivo
  } = req.body;

  

  // Validación mínima
  if (
    !area_atencion ||
    !atendido_por ||
    !puntualidad ||
    !trato ||
    !resolucion ||
    !id_motivo
  ) {
    return res.status(400).json({ success: false, error: "Datos incompletos" });
  }

  try {

    // Obtener ID del área desde la BD
    const [[areaRow]] = await db.query(
      `SELECT id_area FROM areas WHERE nombre_area = ?`,
      [area_atencion]
    );

    if (!areaRow) {
      return res.status(400).json({ success: false, message: "Área inválida" });
    }

    const sql = `
      INSERT INTO calificaciones
      (cedula_usuario, area_atencion, fecha, puntualidad, trato, resolucion, comentario, id_motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      atendido_por,
      areaRow.id_area,
      fecha,
      puntualidad,
      trato,
      resolucion,
      comentario,
      id_motivo
    ]);

    res.json({ success: true });

  } catch (err) {
    console.error("Error guardando encuesta:", err);
    res.status(500).json({ success: false, error: "Error al guardar encuesta" });
  }
});

encuestasRouter.get('/motivos/:area', async (req, res) => {
  const { area } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT m.id_motivo, m.nombre_motivo
      FROM motivos_calificacion m
      JOIN areas a ON m.id_area = a.id_area
      WHERE a.nombre_area = ?
    `, [area]);

    res.json(rows);
  } catch (err) {
    console.error("Error cargando motivos:", err);
    res.status(500).json({ error: "Error al obtener motivos" });
  }
});


export default encuestasRouter;