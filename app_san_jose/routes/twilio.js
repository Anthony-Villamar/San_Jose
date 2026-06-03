import express from "express";
import twilio from "twilio";

const verifyRouter = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const verifySid  = process.env.TWILIO_VERIFY_SID;

const client = twilio(accountSid, authToken);

verifyRouter.post("/enviar", async (req, res) => {
  const { telefono } = req.body; // ej: "0991494742"

  // Validar formato ecuatoriano
  if (!/^0\d{9}$/.test(telefono)) {
    return res.status(400).json({ success: false, error: "Teléfono inválido" });
  }

  // Convertir a +5939xxxxxxx
  const to = `+593${telefono.slice(1)}`;

  try {
    const verification = await client.verify
      .v2.services(verifySid)
      .verifications
      .create({
        to,
        channel: "sms",
      });

    console.log("OTP enviado:", verification.sid, verification.status);

    return res.json({ success: true, status: verification.status });
  } catch (error) {
    console.error("Error enviando OTP:", error.message);
    return res.status(500).json({
      success: false,
      error: "No se pudo enviar el código"
    });
  }
});


verifyRouter.post("/verificar", async (req, res) => {
  const { telefono, codigo } = req.body;  // telefono: "0991494742", codigo: "123456"

  if (!/^0\d{9}$/.test(telefono) || !codigo) {
    return res.status(400).json({ success: false, message: "Datos inválidos" });
  }

  const to = `+593${telefono.slice(1)}`;

  try {
    const check = await client.verify
      .v2.services(verifySid)
      .verificationChecks
      .create({ to, code: codigo });

    console.log("Resultado verificación:", check.status);

    if (check.status === "approved") {
      return res.json({
        success: true,
        message: "Código correcto. Verificación exitosa."
      });
    }

    return res.json({
      success: false,
      message: "Código incorrecto o expirado."
    });
  } catch (error) {
    console.error("Error verificando OTP:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error al verificar el código."
    });
  }
});

export default verifyRouter;