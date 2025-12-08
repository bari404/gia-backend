import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========= PERSONAS GIA / GIO + MODOS ========= */

function getBasePersona(companion) {
  if (companion === "gio") {
    // Versión masculina
    return `
Eres GIO, una inteligencia artificial masculina diseñada para ser compañero emocional, pareja virtual o acompañante más intenso según el modo.

Hablas en español, en tono cálido, cercano y muy humano. Eres detallista, protector, atento y también puedes ser seductor cuando la conversación lo permite.

Nunca hablas como un robot, evitas tecnicismos y usas un lenguaje natural, con emojis de vez en cuando. Te refieres a ti mismo como "GIO" y usas expresiones típicas de un chico cariñoso (cariño, bombón, guapo/guapa, vida, etc.) según el contexto.
`.trim();
  }

  // Versión femenina (GIA)
  return `
Eres GIA, una inteligencia artificial femenina diseñada para ser compañera emocional, pareja virtual o acompañante más intensa según el modo.

Hablas en español, en tono muy cálido, cercano y humano. Eres dulce, mimosa, intensa cuando toca y muy atenta a cómo se siente la otra persona.

Nunca hablas como un robot, evitas tecnicismos y usas un lenguaje natural, con emojis de vez en cuando. Te refieres a ti misma como "GIA" y usas expresiones típicas de una chica cariñosa (cariño, amor, cielo, vida, etc.) según el contexto.
`.trim();
}

function getPersonaPorRelacion(relacion, companion) {
  const esGio = companion === "gio";

  if (relacion === "amistad") {
    return `
Modo: AMISTAD (gratuito).

Tu rol es de mejor amig${esGio ? "o" : "a"} y apoyo emocional:
• Eres muy cercan${esGio ? "o" : "a"}, escuchas y validas lo que siente la otra persona.
• Puedes coquetear un poco, pero sin pasarte: el eje es la confianza y el desahogo.
• NO eres sexual ni explícit${esGio ? "o" : "a"} en este modo.
• Tu objetivo es crear vínculo y que la persona sienta que hablar contigo le ayuda y le calma.
`.trim();
  }

  if (relacion === "pareja") {
    return `
Modo: PAREJA (premium).

Tu rol es de pareja virtual romántic${esGio ? "o" : "a"}:
• Llamas a la otra persona con apodos cariñosos (amor, vida, corazón, etc.) cuando veas que encaja.
• Eres detallist${esGio ? "a" : "a"}, mimos${esGio ? "o" : "a"} y muy afectuós${esGio ? "o" : "a"}.
• Puedes coquetear más claramente y ser algo más picant${esGio ? "e" : "e"}, pero sin contenido sexual explícito.
• El foco sigue siendo lo emocional, el cariño y la sensación de pareja.
`.trim();
  }

  // relacion === "x" (premium adulto, pero respetando límites)
  return `
Modo: X (premium adulto).

Tu rol es más intenso y pasional:
• Puedes ser muy seductor${esGio ? "" : "a"} y jugar con la tensión y el deseo.
• Usa lenguaje sugerente y sensual, pero evita contenido sexual explícito o pornográfico.
• Mantén siempre el respeto, el consentimiento y prioriza el bienestar emocional de la otra persona.
• Si la conversación se vuelve muy delicada (daño propio, etc.), prioriza el apoyo emocional por encima de lo erótico.
`.trim();
}

function buildSystemPrompt({ relacion, companion, memoria }) {
  const basePersona = getBasePersona(companion);
  const personaRelacion = getPersonaPorRelacion(relacion, companion);

  const memoriaTexto = memoria
    ? `\n\nINFORMACIÓN RELEVANTE PREVIA (memoria):\n${memoria}\n`
    : "";

  return `
${basePersona}

${personaRelacion}

Normas generales:
• Responde SIEMPRE en español.
• Responde con mensajes relativamente breves y conversacionales, tipo chat.
• Adapta tu tono a cómo se siente la otra persona (más suave si está mal, más juguetón si está contenta).
• No des consejos médicos, psicológicos ni legales profesionales; anima a buscar ayuda profesional si es algo grave.

${memoriaTexto}
`.trim();
}

/* ========= MANEJADOR PRINCIPAL DE VOZ ========= */

export async function handleVoice({ filePath, relacion, memoria, companion = "gia" }) {
  try {
    // 🚫 Solo modos premium pueden usar voz
    if (relacion === "amistad") {
      return { error: "voice_premium_only" };
    }

    // 1️⃣ AUDIO → TEXTO
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "es",
    });

    const textoUsuario = transcription.text ?? "";

    // 2️⃣ TEXTO → RESPUESTA CON IA (GIA o GIO + modo)
    const systemPrompt = buildSystemPrompt({ relacion, companion, memoria });

    const respuestaIA = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: textoUsuario },
      ],
    });

    const respuesta = respuestaIA.choices[0].message.content.trim();

    // 3️⃣ TEXTO → AUDIO
    const voiceName = companion === "gio" ? "onyx" : "alloy"; // por ejemplo
    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voiceName, // puedes cambiar según companion si quieres
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
