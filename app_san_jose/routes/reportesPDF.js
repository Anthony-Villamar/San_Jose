import express from "express";
import db from "./db.js";
import PDFDocument from "pdfkit";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import Chart from "chart.js/auto";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const reportesRouter = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chartCanvas = new ChartJSNodeCanvas({ width: 600, height: 260, backgroundColour: "white" });

// --- Helpers ---

function nivelInfo(val, max) {
  const pct = val / max;
  if (pct >= 0.78) return { text: "EXCELENTE", color: "#16a34a" };
  if (pct >= 0.55) return { text: "REGULAR",   color: "#f59e0b" };
  return              { text: "DEFICIENTE",    color: "#dc2626" };
}

function drawGauge(doc, cx, cy, r, value, maxValue, color) {
  const lw = 5;
  doc.save().circle(cx, cy, r).lineWidth(lw).strokeColor("#e5e7eb").stroke().restore();
  if (value <= 0) return;
  const pct   = Math.min(value / maxValue, 0.9999);
  const start = -Math.PI / 2;
  const end   = start + pct * 2 * Math.PI;
  const x0 = (cx + r * Math.cos(start)).toFixed(2);
  const y0 = (cy + r * Math.sin(start)).toFixed(2);
  const x1 = (cx + r * Math.cos(end)).toFixed(2);
  const y1 = (cy + r * Math.sin(end)).toFixed(2);
  const la  = pct > 0.5 ? 1 : 0;
  doc.save()
    .path(`M ${x0} ${y0} A ${r} ${r} 0 ${la} 1 ${x1} ${y1}`)
    .lineWidth(lw).strokeColor(color).stroke()
    .restore();
}

function sectionHeader(doc, x, y, num, title, rightX) {
  doc.circle(x + 9, y + 9, 9).fill("#1a3a6b");
  doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
    .text(String(num), x + 5, y + 5, { width: 8, lineBreak: false });
  doc.fillColor("#1a3a6b").fontSize(11).font("Helvetica-Bold")
    .text(title, x + 22, y + 2, { lineBreak: false });
  doc.moveTo(x, y + 22).lineTo(rightX, y + 22).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
}

// --- Endpoint ---

reportesRouter.get("/calificaciones/pdf", async (req, res) => {
  try {
    const { inicio, fin, area, cedula } = req.query;
    const modoPersonal = !!cedula;

    let filtroArea      = "";
    let params          = [inicio, fin];
    let nombreArea      = "GENERAL";
    let areaLabel       = "General";
    let headerSubtitulo = "DEL ÁREA DE GENERAL";

    if (modoPersonal) {
      if (req.session.user?.cedula !== cedula)
        return res.status(403).json({ error: "No autorizado" });

      const [[persona]] = await db.query(
        `SELECT p.nombre, p.apellido, r.nombre_rol AS rol
         FROM personas p
         JOIN usuarios u ON u.cedula = p.cedula
         JOIN roles r ON u.id_rol = r.id_rol
         WHERE p.cedula = ?`, [cedula]
      );

      filtroArea      = "AND c.cedula_usuario = ?";
      params.push(cedula);
      areaLabel       = `${persona.nombre} ${persona.apellido}`;
      nombreArea      = areaLabel.toUpperCase();
      headerSubtitulo = `${persona.nombre} ${persona.apellido}`;

    } else if (area && area !== "todas") {
      const areaId = area === "secretaria" ? 1 : area === "colecturia" ? 2 : null;
      areaLabel    = area === "secretaria" ? "Secretaría" : "Colecturía";
      nombreArea   = areaLabel.toUpperCase();
      headerSubtitulo = `DEL ÁREA DE ${nombreArea}`;
      if (areaId) { filtroArea = "AND c.area_atencion = ?"; params.push(areaId); }
    }

    const [rows] = await db.query(`
      SELECT DATE(c.fecha) AS dia, COUNT(*) AS total,
        AVG(c.puntualidad) AS puntualidad,
        AVG(c.trato)       AS trato,
        AVG(c.resolucion)  AS resolucion,
        SUM(CASE WHEN c.puntualidad >= 2 THEN 1 ELSE 0 END) AS a_tiempo
      FROM calificaciones c
      WHERE DATE(c.fecha) BETWEEN ? AND ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
        ${filtroArea}
      GROUP BY dia ORDER BY dia
    `, params);

    if (rows.length === 0)
      return res.status(404).json({ error: "No existen datos para generar reporte" });

    const total       = rows.reduce((a, b) => a + b.total, 0);
    const avgP        = rows.reduce((a, b) => a + Number(b.puntualidad) * b.total, 0) / total;
    const avgT        = rows.reduce((a, b) => a + Number(b.trato)       * b.total, 0) / total;
    const avgR        = rows.reduce((a, b) => a + Number(b.resolucion)  * b.total, 0) / total;
    const topDay      = rows.reduce((mx, r) => r.total > mx.total ? r : mx);
    const totalATiempo = rows.reduce((a, b) => a + Number(b.a_tiempo), 0);
    const pctATiempo  = total > 0 ? Math.round(totalATiempo / total * 100) : 0;
    const nvTiempo    = pctATiempo >= 90 ? { text: "EXCELENTE", color: "#16a34a" } : pctATiempo >= 75 ? { text: "REGULAR", color: "#f59e0b" } : { text: "DEFICIENTE", color: "#dc2626" };

    const nvP = nivelInfo(avgP, 3);
    const nvT = nivelInfo(avgT, 3);
    const nvR = nivelInfo(avgR, 3);

    // --- Charts ---
    const lineChart = await chartCanvas.renderToBuffer({
      type: "line",
      data: {
        labels: rows.map(r => String(r.dia).slice(0, 10)),
        datasets: [{ label: "Atenciones", data: rows.map(r => r.total),
          borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.1)",
          tension: 0.4, fill: true, pointBackgroundColor: "#2563eb", pointRadius: 4 }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Número de atenciones", font: { size: 11 }, color: "#6b7280" }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#f3f4f6" } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
        }
      }
    });

    const barChart = await chartCanvas.renderToBuffer({
      type: "bar",
      data: {
        labels: rows.map(r => String(r.dia).slice(0, 10)),
        datasets: [
          { label: "Puntualidad", data: rows.map(r => r.puntualidad), backgroundColor: "#2563eb", borderRadius: 3 },
          { label: "Trato",       data: rows.map(r => r.trato),       backgroundColor: "#16a34a", borderRadius: 3 },
          { label: "Resolución",  data: rows.map(r => r.resolucion),  backgroundColor: "#f59e0b", borderRadius: 3 }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 9 } } },
          title: { display: true, text: "Calificación promedio", font: { size: 11 }, color: "#6b7280" }
        },
        scales: {
          y: { beginAtZero: true, max: 3, ticks: { stepSize: 1 }, grid: { color: "#f3f4f6" } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
        }
      }
    });

    // --- AI: structured JSON ---
    const resumenIA = rows.map(r =>
      `${String(r.dia).slice(0,10)}: total=${r.total}, punt=${r.puntualidad}/3, trato=${r.trato}/3, res=${r.resolucion}/3`
    ).join("\n");

    let ia = null;
    try {
      const resp = await openai.responses.create({
        model: "gpt-4o-mini",
        input: `Eres analista de calidad educativa. Devuelve ÚNICAMENTE JSON válido (sin markdown) con esta estructura:
{
  "resumen": "resumen del periodo en 2 oraciones",
  "observacion": "observación clave sobre los datos en 2 oraciones",
  "puntualidad": { "analisis": "2-3 oraciones", "recomendacion": "1 oración concreta" },
  "trato":       { "analisis": "2-3 oraciones", "recomendacion": "1 oración concreta" },
  "resolucion":  { "analisis": "2-3 oraciones", "recomendacion": "1 oración concreta" },
  "recomendaciones": [
    { "titulo": "2-3 palabras", "descripcion": "2 oraciones" },
    { "titulo": "2-3 palabras", "descripcion": "2 oraciones" },
    { "titulo": "2-3 palabras", "descripcion": "2 oraciones" }
  ],
  "cita": "frase motivacional máximo 15 palabras"
}
Periodo ${inicio} al ${fin}, área: ${areaLabel}.
Promedios: Puntualidad=${avgP.toFixed(2)}/3 (${nvP.text}), Trato=${avgT.toFixed(2)}/3 (${nvT.text}), Resolución=${avgR.toFixed(2)}/3 (${nvR.text}).
Datos diarios:\n${resumenIA}`,
        temperature: 0.7
      });
      let raw = (resp.output_text || "").replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      ia = JSON.parse(raw);
    } catch {
      ia = {
        resumen: `Informe del área de ${areaLabel} para el periodo ${inicio} al ${fin}. Se registraron ${total} atenciones en total.`,
        observacion: "Los datos muestran variaciones en las calificaciones durante el periodo analizado.",
        puntualidad: { analisis: `La puntualidad obtuvo un promedio de ${avgP.toFixed(2)}/3.`, recomendacion: "Revisar la distribución de turnos y tiempos de espera." },
        trato:       { analisis: `El trato obtuvo un promedio de ${avgT.toFixed(2)}/3.`,       recomendacion: "Reforzar la capacitación en atención al usuario." },
        resolucion:  { analisis: `La resolución obtuvo un promedio de ${avgR.toFixed(2)}/3.`,  recomendacion: "Optimizar los procesos de seguimiento de casos." },
        recomendaciones: [
          { titulo: "Capacitación continua", descripcion: "Implementar programas de formación periódica en atención al usuario." },
          { titulo: "Revisión de procesos",  descripcion: "Evaluar y optimizar los flujos de atención para mejorar tiempos." },
          { titulo: "Monitoreo mensual",     descripcion: "Establecer revisiones mensuales de indicadores de calidad." }
        ],
        cita: "La mejora continua en la atención es clave para la confianza de nuestros usuarios."
      };
    }

    // --- PDF ---
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=reporte_${Date.now()}.pdf`);
    doc.pipe(res);

    const W   = doc.page.width;   // 595
    const H   = doc.page.height;  // 842
    const PAD = 32;
    const CW  = W - PAD * 2;      // 531

    const chartW = Math.floor(CW * 0.71); // ~377
    const sideW  = CW - chartW - 8;       // ~146
    const chartH = 158;

    // =========================================================
    // PAGE 1
    // =========================================================

    // HEADER
    doc.rect(0, 0, W, 92).fill("#1a3a6b");
    doc.rect(0, 87, W, 6).fill("#0ea5e9");

    const logoPath = path.join(__dirname, "..", "public", "images", "logo2.png");
    try {
      if (fs.existsSync(logoPath))
        doc.image(logoPath, PAD, 8, { width: 68, height: 68 });
    } catch {}

    doc.fillColor("white").fontSize(21).font("Helvetica-Bold")
      .text("REPORTE DE CALIFICACIONES", PAD + 78, 10, { lineBreak: false });
    doc.fillColor("#7dd3fc").fontSize(13).font("Helvetica-Bold")
      .text(headerSubtitulo, PAD + 78, 36, { lineBreak: false });
    doc.fillColor("#bfdbfe").fontSize(9).font("Helvetica")
      .text("Sistema de Gestión de Calificaciones - San José", PAD + 78, 58, { lineBreak: false });

    // INFO CARDS ROW
    const infoY = 100;
    const infoH = 50;
    const cardW = (CW - 3) / 4;

    doc.roundedRect(PAD, infoY, CW, infoH, 4).fill("#f8fafc");
    doc.roundedRect(PAD, infoY, CW, infoH, 4).lineWidth(0.8).strokeColor("#e2e8f0").stroke();

    const infoItems = [
      { label: "PERIODO DEL REPORTE", value: `Desde: ${inicio}\nHasta: ${fin}` },
      { label: "ÁREA ANALIZADA",      value: areaLabel },
      { label: "TOTAL DE ATENCIONES", value: String(total), big: true },
      { label: "FECHA DEL REPORTE",   value: new Date().toLocaleDateString("es-EC", { day:"numeric", month:"long", year:"numeric" }) }
    ];
    infoItems.forEach((item, i) => {
      const ix = PAD + i * (cardW + 1);
      if (i > 0) doc.moveTo(ix, infoY + 8).lineTo(ix, infoY + infoH - 8).lineWidth(0.5).strokeColor("#cbd5e1").stroke();
      doc.fillColor("#1a3a6b").fontSize(6.5).font("Helvetica-Bold")
        .text(item.label, ix + 7, infoY + 7, { width: cardW - 10 });
      doc.fillColor("#334155").fontSize(item.big ? 14 : 8).font(item.big ? "Helvetica-Bold" : "Helvetica")
        .text(item.value, ix + 7, infoY + 18, { width: cardW - 10, lineGap: 1 });
    });

    // SECTION 1 — RESUMEN
    let Y = infoY + infoH + 12;
    sectionHeader(doc, PAD, Y, 1, "RESUMEN GENERAL", W - PAD);
    Y += 26;

    doc.fillColor("#4b5563").fontSize(8.5).font("Helvetica")
      .text(ia.resumen, PAD, Y, { width: CW, lineGap: 2 });
    Y += doc.heightOfString(ia.resumen, { width: CW, lineGap: 2 }) + 10;

    // METRIC CARDS
    const mW = (CW - 15) / 4;
    const mH = 88;
    const metrics = [
      { label: "PUNTUALIDAD",   value: avgP,       color: "#2563eb", nv: nvP,      isPct: false },
      { label: "TRATO",         value: avgT,       color: "#16a34a", nv: nvT,      isPct: false },
      { label: "RESOLUCIÓN",    value: avgR,       color: "#f59e0b", nv: nvR,      isPct: false },
      { label: "% A TIEMPO",    value: pctATiempo, color: "#0ea5e9", nv: nvTiempo, isPct: true  }
    ];
    metrics.forEach((m, i) => {
      const mx = PAD + i * (mW + 5);
      const my = Y;
      doc.roundedRect(mx, my, mW, mH, 5).fill("white");
      doc.roundedRect(mx, my, mW, mH, 5).lineWidth(0.8).strokeColor("#e2e8f0").stroke();
      doc.rect(mx, my, mW, 4).fill(m.color);
      doc.fillColor(m.color).fontSize(7).font("Helvetica-Bold")
        .text(m.label, mx + 6, my + 9, { width: mW - 12, align: "center" });
      const gaugeMax  = m.isPct ? 100 : 3;
      const displayV  = m.isPct ? `${m.value}%` : m.value.toFixed(2);
      const displaySb = m.isPct ? "de 100%" : "de 3.00";
      drawGauge(doc, mx + mW - 26, my + mH / 2 + 5, 17, m.value, gaugeMax, m.color);
      doc.fillColor("#111827").fontSize(m.isPct ? 16 : 18).font("Helvetica-Bold")
        .text(displayV, mx + 6, my + 20, { width: mW - 52 });
      doc.fillColor("#9ca3af").fontSize(7).font("Helvetica")
        .text(displaySb, mx + 6, my + 41, { width: mW - 52 });
      doc.roundedRect(mx + 4, my + mH - 21, mW - 8, 14, 3).fill(m.nv.color + "22");
      doc.fillColor(m.nv.color).fontSize(6.5).font("Helvetica-Bold")
        .text(`Nivel: ${m.nv.text}`, mx + 4, my + mH - 18, { width: mW - 8, align: "center" });
    });
    Y += mH + 14;

    // SECTION 2 — LINE CHART
    sectionHeader(doc, PAD, Y, 2, "EVOLUCIÓN DE ATENCIONES DIARIAS", W - PAD);
    Y += 26;

    doc.image(lineChart, PAD, Y, { width: chartW, height: chartH });

    const sX = PAD + chartW + 8;
    doc.roundedRect(sX, Y, sideW, chartH, 5).fill("#eff6ff");
    doc.roundedRect(sX, Y, sideW, chartH, 5).lineWidth(0.8).strokeColor("#bfdbfe").stroke();
    doc.fillColor("#1e40af").fontSize(8).font("Helvetica-Bold")
      .text("DÍA CON MÁS\nATENCIONES", sX + 6, Y + 10, { width: sideW - 12, align: "center", lineGap: 2 });
    doc.fillColor("#1d4ed8").fontSize(9).font("Helvetica-Bold")
      .text(String(topDay.dia).slice(0, 10), sX + 6, Y + 52, { width: sideW - 12, align: "center" });
    doc.fillColor("#6b7280").fontSize(7.5).font("Helvetica")
      .text("Total de atenciones", sX + 6, Y + 68, { width: sideW - 12, align: "center" });
    doc.fillColor("#1a3a6b").fontSize(26).font("Helvetica-Bold")
      .text(String(topDay.total), sX + 6, Y + 80, { width: sideW - 12, align: "center" });
    Y += chartH + 12;

    // SECTION 3 — BAR CHART
    sectionHeader(doc, PAD, Y, 3, "PROMEDIO DE CALIFICACIONES POR DÍA", W - PAD);
    Y += 26;

    doc.image(barChart, PAD, Y, { width: chartW, height: chartH });

    doc.roundedRect(sX, Y, sideW, chartH, 5).fill("#fefce8");
    doc.roundedRect(sX, Y, sideW, chartH, 5).lineWidth(0.8).strokeColor("#fde68a").stroke();
    doc.fillColor("#92400e").fontSize(8).font("Helvetica-Bold")
      .text("OBSERVACIÓN", sX + 6, Y + 10, { width: sideW - 12, align: "center" });
    doc.fillColor("#78350f").fontSize(7.5).font("Helvetica")
      .text(ia.observacion, sX + 6, Y + 26, { width: sideW - 12, lineGap: 2 });
    Y += chartH + 14;

    // =========================================================
    // PAGE 2
    // =========================================================
    doc.addPage({ size: "A4", margin: 0 });
    doc.rect(0, 0, W, 8).fill("#0ea5e9");
    Y = 18;

    // SECTION 4 — ANALYSIS PER ASPECT
    sectionHeader(doc, PAD, Y, 4, "ANÁLISIS Y RETROALIMENTACIÓN POR ASPECTO", W - PAD);
    Y += 26;

    const aspects = [
      { label: "PUNTUALIDAD", color: "#2563eb", data: ia.puntualidad, nv: nvP },
      { label: "TRATO",       color: "#16a34a", data: ia.trato,       nv: nvT },
      { label: "RESOLUCIÓN",  color: "#f59e0b", data: ia.resolucion,  nv: nvR }
    ];
    const aW = (CW - 10) / 3;
    const aTextH = Math.max(...aspects.map(a =>
      doc.heightOfString(a.data.analisis, { width: aW - 14, lineGap: 1.5 }) +
      doc.heightOfString(a.data.recomendacion, { width: aW - 14, lineGap: 1.5 })
    ));
    const aH = Math.max(115, aTextH + 52);

    aspects.forEach((a, i) => {
      const ax = PAD + i * (aW + 5);
      const ay = Y;
      doc.roundedRect(ax, ay, aW, aH, 5).fill("white");
      doc.roundedRect(ax, ay, aW, aH, 5).lineWidth(0.8).strokeColor("#e2e8f0").stroke();
      doc.rect(ax, ay, aW, 4).fill(a.color);
      doc.fillColor(a.color).fontSize(7.5).font("Helvetica-Bold")
        .text(a.label, ax + 7, ay + 9, { width: aW - 14 });
      doc.fillColor("#374151").fontSize(7.5).font("Helvetica")
        .text(a.data.analisis, ax + 7, ay + 22, { width: aW - 14, lineGap: 1.5 });
      const anH = doc.heightOfString(a.data.analisis, { width: aW - 14, lineGap: 1.5 });
      doc.fillColor(a.color).fontSize(7).font("Helvetica-Bold")
        .text("→ " + a.data.recomendacion, ax + 7, ay + 26 + anH, { width: aW - 14, lineGap: 1.5 });
      doc.roundedRect(ax + 5, ay + aH - 20, aW - 10, 13, 3).fill(a.nv.color + "22");
      doc.fillColor(a.nv.color).fontSize(7).font("Helvetica-Bold")
        .text(`Nivel: ${a.nv.text}`, ax + 5, ay + aH - 17, { width: aW - 10, align: "center" });
    });
    Y += aH + 14;

    // SECTION 5 — RECOMMENDATIONS
    sectionHeader(doc, PAD, Y, 5, "RECOMENDACIONES GENERALES", W - PAD);
    Y += 26;

    const rW = (CW - 10) / 3;
    const rColors = ["#2563eb", "#16a34a", "#f59e0b"];
    const rSymbols = ["1", "2", "3"];
    const rMaxH = Math.max(...ia.recomendaciones.map(r =>
      doc.heightOfString(r.descripcion, { width: rW - 14, lineGap: 1.5 })
    ));
    const rH = Math.max(80, rMaxH + 50);

    ia.recomendaciones.forEach((r, i) => {
      const rx = PAD + i * (rW + 5);
      const ry = Y;
      doc.roundedRect(rx, ry, rW, rH, 5).fill("white");
      doc.roundedRect(rx, ry, rW, rH, 5).lineWidth(0.8).strokeColor("#e2e8f0").stroke();
      doc.circle(rx + rW / 2, ry + 18, 11).fill(rColors[i] + "22");
      doc.fillColor(rColors[i]).fontSize(11).font("Helvetica-Bold")
        .text(rSymbols[i], rx + rW / 2 - 5, ry + 12, { width: 10, lineBreak: false });
      doc.fillColor("#1a3a6b").fontSize(7.5).font("Helvetica-Bold")
        .text(r.titulo, rx + 6, ry + 34, { width: rW - 12, align: "center" });
      doc.fillColor("#4b5563").fontSize(7.5).font("Helvetica")
        .text(r.descripcion, rx + 6, ry + 47, { width: rW - 12, lineGap: 1.5 });
    });
    Y += rH + 16;

    // FOOTER
    const footerY = H - 52;
    doc.rect(0, footerY, W, 52).fill("#1a3a6b");
    doc.moveTo(0, footerY).lineTo(W, footerY).lineWidth(3).strokeColor("#0ea5e9").stroke();

    doc.fillColor("#bfdbfe").fontSize(8.5).font("Helvetica-Oblique")
      .text(`"${ia.cita}"`, PAD, footerY + 12, { width: CW - 90, align: "left", lineBreak: false });
    doc.fillColor("white").fontSize(12).font("Helvetica-Bold")
      .text("San José", W - PAD - 68, footerY + 10, { lineBreak: false });
    doc.fillColor("#7dd3fc").fontSize(8).font("Helvetica")
      .text(new Date().toLocaleDateString("es-EC", { day:"numeric", month:"long", year:"numeric" }),
        W - PAD - 68, footerY + 28, { lineBreak: false });

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando reporte PDF" });
  }
});

export default reportesRouter;
