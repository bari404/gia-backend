import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handleVoice({ filePath, relacion, memoria }) {
  try {
    // 1️⃣ AUDIO → TEXTO
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "es",
    });

    const textoUsuario = transcription.text ?? "";

    // 2️⃣ TEXTO → RESPUESTA CON IA
    const respuestaIA = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            `Eres una compañera emocional cálida. Responde en español. Relación: ${relacion}.`
        },
        { role: "user", content: textoUsuario }
      ],
    });

    const respuesta = respuestaIA.choices[0].message.content.trim();

    // 3️⃣ TEXTO → AUDIO
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: respuesta,
      format: "mp3",
    });

    const audioBase64 = Buffer.from(audioResponse.data).toString("base64");

    return {
      textoUsuario,
      respuesta,
      memoria,
      audioBase64,
    };

  } catch (err) {
    console.error("ERROR EN VOICE.JS:", err);
    return { error: "voice_fail" };
  }
}
