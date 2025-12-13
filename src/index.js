// backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

import { handleIA } from "./ia/handler.js";
import { handleVoice } from "./ia/voice.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(
  "[index.js] API KEY:",
  process.env.OPENAI_API_KEY ? "OK" : "NO CARGADA"
);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS abierto (para tu dominio y pruebas)
app.use(
  cors({
    origin: "*",
  })
);
// Preflight
app.options("*", cors());

app.use(express.json());

app.get("/api/stripe/ping", (req, res) => {
  res.json({ ok: true, where: "src/index.js" });
});

// carpeta temporal para subir audio
const upload = multer({ dest: "uploads/" });

/* ======================================================
   ENDPOINT IA TEXTO
====================================================== */
app.post("/api/ia", async (req, res) => {
  try {
    const {
      mensaje,
      modo,
      relacion,
      memoria,
      userId,
      companion, // 👈 viene del frontend: "gia" o "gio"
    } = req.body;

    const data = await handleIA({
      mensaje,
      modo,
      relacion,
      memoria,
      userId,
      companion, // 👈 se lo pasamos al handler
    });

    res.json(data);
  } catch (err) {
    console.error("Error en /api/ia:", err);
    res.status(500).json({ error: "ia_fail" });
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
// ======================================================
// ENDPOINT DE SALUD (para probar que está levantado)
// GET https://gia-backend-production-2f8c.up.railway.app
// ======================================================
app.get("/", (req, res) => {
  res.json({ ok: true });
});

/* ======================================================
   SERVIDOR
====================================================== */
app.listen(PORT, () => {
  console.log("Backend escuchando en http://localhost:" + PORT);
});
