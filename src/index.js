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
   CORS
====================================================== */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://giachatlove.com",
  "https://www.giachatlove.com",
];

// Middleware global CORS + log
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // origen permitido: reflejamos el origin
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // por si viene de otro sitio (p.ej. tests, extensiones…)
    res.setHeader("Access-Control-Allow-Origin", "*");
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

  // responder directamente a los preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// cors extra (no hace daño y ayuda con OPTIONS en algunos entornos)
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
