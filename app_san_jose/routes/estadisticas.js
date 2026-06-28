import express from 'express';
import db from './db.js';

const estadisticasRouter = express.Router();

estadisticasRouter.get('/detalle', async (req, res) => {
  const cedula = req.session.user?.cedula;
  if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });

  try {
    const sql = `
      SELECT
        COUNT(*) AS total_atenciones,
        ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
        ROUND(AVG(c.trato), 2) AS promedio_trato,
        ROUND(AVG(c.resolucion), 2) AS promedio_resolucion,
        ROUND(SUM(CASE WHEN c.puntualidad >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_a_tiempo,
        ROUND(SUM(CASE WHEN c.resolucion >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_fcr,
        ROUND(SUM(CASE WHEN ROUND((c.puntualidad + c.trato + c.resolucion) / 3.0) >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_csat
      FROM calificaciones c
      JOIN usuarios u ON u.cedula = c.cedula_usuario
      WHERE c.cedula_usuario = ?
        AND u.estado = 'activo'
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
    `;
    const [rows] = await db.query(sql, [cedula]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas detalladas' });
  }
});

estadisticasRouter.get('/top3', async (req, res) => {
  try {
    const sql = `
      SELECT
  p.nombre, p.apellido,
  ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
  ROUND(AVG(c.trato), 2) AS promedio_trato,
  ROUND(AVG(c.resolucion), 2) AS promedio_resolucion,
  ROUND(AVG((c.puntualidad + c.trato + c.resolucion) / 3), 2) AS promedio
FROM calificaciones c
JOIN personas p ON c.cedula_usuario = p.cedula
JOIN usuarios u ON u.cedula = p.cedula
WHERE u.estado = 'activo'
  AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
GROUP BY c.cedula_usuario
ORDER BY promedio DESC
LIMIT 3;
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

estadisticasRouter.get('/detalle/diario', async (req, res) => {
  const cedula = req.session.user?.cedula;
  if (!cedula) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  try {
    const sql = `
      SELECT
        DATE(c.fecha) AS fecha,
        ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
        ROUND(AVG(c.trato), 2) AS promedio_trato,
        ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY DATE(c.fecha)
      ORDER BY fecha DESC
    `;

    const [rows] = await db.query(sql, [cedula]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas por día' });
  }
});

estadisticasRouter.get('/detalle/promedio', async (req, res) => {
  const cedula = req.session.user?.cedula;
  const { desde, hasta } = req.query;

  if (!cedula) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  if (!desde || !hasta) {
    return res.status(400).json({ message: 'Fechas requeridas' });
  }

  try {
    const sql = `
      SELECT
        ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
        ROUND(AVG(c.trato), 2) AS promedio_trato,
        ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND DATE(c.fecha) BETWEEN ? AND ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
    `;

    const [rows] = await db.query(sql, [cedula, desde, hasta]);

    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener promedio' });
  }
});

estadisticasRouter.get("/calendario", async (req, res) => {
  try {
    const { inicio, fin, area } = req.query;

    let filtroArea = "";
    let params = [inicio, fin];

    if (area && area !== "todas") {
      const areaId =
        area === "secretaria" ? 1 :
        area === "colecturia" ? 2 :
        area === "docente" ? 3 :
        null;

      if (areaId) {
        filtroArea = "AND c.area_atencion = ?";
        params.push(areaId);
      }
    }

    const [rows] = await db.query(
      `
      SELECT
        DATE(c.fecha) AS dia,
        COUNT(*) AS total,
        ROUND(AVG(c.puntualidad), 2) AS puntualidad,
        ROUND(AVG(c.trato), 2) AS trato,
        ROUND(AVG(c.resolucion), 2) AS resolucion
      FROM calificaciones c
      WHERE DATE(c.fecha) BETWEEN ? AND ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
        ${filtroArea}
      GROUP BY dia
      ORDER BY dia;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error calendario:", err);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});


estadisticasRouter.get('/mis-motivos', async (req, res) => {
  const cedula = req.session.user?.cedula;
  if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });
  try {
    const [rows] = await db.query(`
      SELECT m.nombre_motivo, COUNT(*) AS total
      FROM calificaciones c
      JOIN motivos_calificacion m ON c.id_motivo = m.id_motivo
      WHERE c.cedula_usuario = ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY c.id_motivo
      ORDER BY total DESC
      LIMIT 6
    `, [cedula]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener motivos' });
  }
});

estadisticasRouter.get('/mi-tendencia', async (req, res) => {
  const cedula = req.session.user?.cedula;
  if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });
  try {
    const [rows] = await db.query(`
      SELECT DATE(c.fecha) AS dia,
        ROUND(AVG(c.puntualidad), 2) AS puntualidad,
        ROUND(AVG(c.trato), 2) AS trato,
        ROUND(AVG(c.resolucion), 2) AS resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND DATE(c.fecha) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY dia ORDER BY dia
    `, [cedula]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tendencia' });
  }
});

estadisticasRouter.get('/mis-comentarios', async (req, res) => {
  const cedula = req.session.user?.cedula;
  if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });
  try {
    const [rows] = await db.query(`
      SELECT c.comentario, DATE(c.fecha) AS fecha,
        c.puntualidad, c.trato, c.resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND c.comentario IS NOT NULL
        AND c.comentario != ''
        AND c.comentario != 'Sin comentarios'
      ORDER BY c.fecha DESC
      LIMIT 10
    `, [cedula]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

estadisticasRouter.get('/resumen', async (req, res) => {
  try {
    const [[hoy]] = await db.query(`
      SELECT COUNT(*) AS total FROM calificaciones
      WHERE DATE(fecha) = CURDATE()
        AND TIME(fecha) BETWEEN '07:00:00' AND '14:30:00'
    `);
    const [[mes]] = await db.query(`
      SELECT COUNT(*) AS total,
        ROUND(AVG((puntualidad + trato + resolucion) / 3), 2) AS promedio,
        ROUND(SUM(CASE WHEN puntualidad >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_a_tiempo,
        ROUND(SUM(CASE WHEN resolucion >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_fcr,
        ROUND(SUM(CASE WHEN ROUND((puntualidad + trato + resolucion) / 3.0) >= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_csat
      FROM calificaciones
      WHERE YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())
        AND TIME(fecha) BETWEEN '07:00:00' AND '14:30:00'
    `);
    const [[mejorArea]] = await db.query(`
      SELECT a.nombre_area,
        ROUND(AVG((c.puntualidad + c.trato + c.resolucion) / 3), 2) AS promedio
      FROM calificaciones c
      JOIN areas a ON c.area_atencion = a.id_area
      WHERE YEAR(c.fecha) = YEAR(CURDATE()) AND MONTH(c.fecha) = MONTH(CURDATE())
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY a.id_area ORDER BY promedio DESC LIMIT 1
    `);
    res.json({
      total_hoy: hoy.total,
      total_mes: mes.total,
      promedio_mes: mes.promedio ?? 0,
      pct_a_tiempo: mes.pct_a_tiempo ?? 0,
      pct_fcr: mes.pct_fcr ?? 0,
      pct_csat: mes.pct_csat ?? 0,
      mejor_area: mejorArea?.nombre_area ?? '—',
      mejor_area_promedio: mejorArea?.promedio ?? 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

estadisticasRouter.get('/tendencia', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(fecha) AS dia, COUNT(*) AS total
      FROM calificaciones
      WHERE DATE(fecha) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND TIME(fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY dia ORDER BY dia
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tendencia' });
  }
});

estadisticasRouter.get('/por-area', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.nombre_area,
        ROUND(AVG(c.puntualidad), 2) AS puntualidad,
        ROUND(AVG(c.trato), 2) AS trato,
        ROUND(AVG(c.resolucion), 2) AS resolucion
      FROM calificaciones c
      JOIN areas a ON c.area_atencion = a.id_area
      WHERE DATE(c.fecha) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY a.id_area
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos por área' });
  }
});

estadisticasRouter.get('/por-dia-semana', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DAYOFWEEK(fecha) AS dia_num, COUNT(*) AS total
      FROM calificaciones
      WHERE DATE(fecha) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND TIME(fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY dia_num ORDER BY dia_num
    `);
    const nombres = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const orden   = [2,3,4,5,6,7,1]; // Lun→Dom
    const result  = orden.map(n => ({
      dia:   nombres[n - 1],
      total: rows.find(r => Number(r.dia_num) === n)?.total ?? 0
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos por día de semana' });
  }
});

export default estadisticasRouter;
