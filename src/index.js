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

const corsOptions = {
  origin: (origin, callback) => {
    // peticiones sin origin (Postman, curl...) -> permitir
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn("[CORS] Origin NO permitido:", origin);
      return callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  credentials: true, // por si en el futuro usas cookies/autenticación
};

// aplicar CORS global
app.use(cors(corsOptions));
// responder preflight OPTIONS
app.options("*", cors(corsOptions));

/* ======================================================
   LOG BÁSICO DE REQUEST
====================================================== */
app.use((req, res, next) => {
  console.log(
    `[REQ] ${req.method} ${req.path} - Origin: ${req.headers.origin || "sin origin"}`
  );
  next();
});

/* ======================================================
   MIDDLEWARES GENERALES
====================================================== */
app.use(express.json({ limit: "2mb" }));

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

    return res.json(datos);
  } catch (err) {
    console.error("❌ ERROR EN /api/ia:", err);
    return res.status(500).json({ error: "Error procesando la IA" });
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

    return res.json(datos);
  } catch (e) {
    console.error("ERROR EN /api/voice:", e);
    return res.status(500).json({ error: "error_voice" });
  }
});

/* ======================================================
   SERVIDOR
====================================================== */
app.listen(PORT, () => {
  console.log("Backend escuchando en http://localhost:" + PORT);
});

