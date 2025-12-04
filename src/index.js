// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import multer from "multer";
import fs from "fs";

import { handleIA } from "./ia/handler.js";
import { handleVoice } from "./ia/voice.js";

console.log(
  "[index.js] API KEY:",
  process.env.OPENAI_API_KEY ? "OK" : "NO CARGADA"
);

const app = express();
const PORT = process.env.PORT || 3001;

/* ======================================================
   CORS SUPER EXPLÍCITO
====================================================== */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://giachatlove.com",
  "https://www.giachatlove.com",
];

// Middleware global CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // en caso extremo, puedes abrirlo así:
    // res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader("Vary", "Origin");

  console.log(
    `[REQ] ${req.method} ${req.path} - Origin: ${origin || "sin origin"}`
  );

  // Responder directamente a los preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Si quieres, puedes mantener también cors() por si acaso
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
  })
);

app.use(express.json());

// carpeta temporal para subir audio
const upload = multer({ dest: "uploads/" });

/* ======================================================
   ENDPOINT IA TEXTO
====================================================== */
app.post("/api/ia", async (req, res) => {
  try {
    const { mensaje, modo, relacion, memoria, userId } = req.body || {};

    if (!mensaje) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    console.log("[/api/ia] userId recibido:", userId);

    const datos = await handleIA({
      mensaje,
      modo,
      relacion,
      memoria,
      userId,
    });

    res.json(datos);
  } catch (err) {
    console.error("❌ ERROR EN /api/ia:", err);
    res.status(500).json({ error: "Error procesando la IA" });
  }
});

/* ======================================================
   ENDPOINT IA VOZ (CON MULTER) 🎤
====================================================== */
app.post("/api/voice", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("❌ No llegó archivo");
      return res.status(400).json({ error: "no_audio" });
    }

    const filePath = req.file.path;
    console.log("📥 Archivo recibido:", filePath);

    const memoria = JSON.parse(req.body.memoria || "null");
    const relacion = req.body.relacion || "amistad";

    const datos = await handleVoice({
      filePath,
      relacion,
      memoria,
    });

    // borrar archivo temporal
    fs.unlink(filePath, () => {});

    res.json(datos);
  } catch (e) {
    console.error("ERROR EN /api/voice:", e);
    res.status(500).json({ error: "error_voice" });
  }
});

/* ======================================================
   SERVIDOR
====================================================== */
app.listen(PORT, () => {
  console.log("Backend escuchando en http://localhost:" + PORT);
});
