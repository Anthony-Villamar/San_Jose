// Ruta para generar mensajes motivacionales usando la API de OpenAI
import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Temporal } from '@js-temporal/polyfill';
dotenv.config();

const iaRouter = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const dailyCache = new Map();

const VENTANA_HORAS = 1;
const UMBRAL_CAMBIO = 0.5;

function hoyEC() {
  return Temporal.Now.plainDateISO('America/Guayaquil').toString();
}
function getUserId(req) {
  return req.session?.user?.cedula || req.user?.id || 'anon';
}
function nowMs() {
  return Temporal.Now.instant().epochMilliseconds;
}

function normCategoria(c) { return String(c || '').trim(); }
function clamp05(n) { const x = Number(n); return Number.isFinite(x) ? Math.min(5, Math.max(0, x)) : 0; }

iaRouter.post('/generar-mensaje', async (req, res) => {
  let { categoria, puntaje, force } = req.body || {};
  if (categoria == null || typeof puntaje !== 'number') {
    return res.status(400).json({ mensaje: "Se requiere 'categoria' y 'puntaje' numérico" });
  }

  categoria = normCategoria(categoria);
  puntaje   = clamp05(puntaje);

  const userId  = getUserId(req);
  const fecha   = hoyEC();
  const cacheKey = `${userId}|${fecha}|${categoria}`;
  const now      = nowMs();

  const cached = dailyCache.get(cacheKey);

  if (!cached) {
    try {
      const mensaje = await generarMensaje(client, categoria, puntaje);
      dailyCache.set(cacheKey, { mensaje, fecha, userId, categoria, puntaje, timestamp: now });
      res.set('Cache-Control', 'no-store');
      return res.json({ mensaje, fuente: 'ia', fecha, categoria, puntaje_usado: puntaje });
    } catch (err) {
      console.error("Error IA:", err);
      return res.status(500).json({ mensaje: "Error generando mensaje motivacional" });
    }
  }

  if (!force) {
    const horasPasadas = (now - cached.timestamp) / 3600000;

    if (horasPasadas < VENTANA_HORAS) {
      res.set('Cache-Control', 'no-store');
      return res.json({
        mensaje: cached.mensaje,
        fuente: 'cache',
        fecha,
        categoria,
        puntaje_usado: cached.puntaje,
        proximo_intento_en_min: Math.max(0, Math.ceil((VENTANA_HORAS - horasPasadas) * 60))
      });
    }

    const cambio = Math.abs(puntaje - Number(cached.puntaje));
    if (cambio < UMBRAL_CAMBIO) {
      res.set('Cache-Control', 'no-store');
      return res.json({
        mensaje: cached.mensaje,
        fuente: 'cache',
        fecha,
        categoria,
        puntaje_usado: cached.puntaje,
        nota: 'Sin cambio significativo tras 1h; se mantiene mensaje'
      });
    }
  }

  try {
    const mensaje = await generarMensaje(client, categoria, puntaje);
    dailyCache.set(cacheKey, { mensaje, fecha, userId, categoria, puntaje, timestamp: now });
    res.set('Cache-Control', 'no-store');
    return res.json({
      mensaje,
      fuente: 'refresh',
      fecha,
      categoria,
      puntaje_usado: puntaje
    });
  } catch (err) {
    console.error("Error IA:", err);
    return res.status(500).json({ mensaje: "Error generando mensaje motivacional" });
  }
});

export default iaRouter;

async function generarMensaje(client, categoria, puntaje) {
  const prompt = `
    Eres un asistente que genera un mensaje motivacional POSITIVO y MUY breve,
    en una sola línea, sin emojis, para un usuario sobre su ${categoria}
    con puntaje ${puntaje} (0–5). Máximo 16 palabras.
  `.trim();

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    temperature: 0.7
  });

  return (
    response.output_text ??
    response.output?.[0]?.content?.[0]?.text ??
    "¡Sigue adelante! Estás progresando."
  );
}