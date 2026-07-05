import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Google Gen AI lazily to avoid crashing if GEMINI_API_KEY is not defined yet
let ai: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is missing or using placeholder value. AI chat will run in local backup mode.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

// API endpoint for AI brief-gathering chat
app.post("/api/ai-chat", async (req, res) => {
  try {
    const { orderType, messages, answers, currentFieldName, nextFieldName, options } = req.body;

    const client = getGeminiClient();
    if (!client) {
      // Return a graceful indicator to run in standard mock fallback on client side
      return res.json({ fallback: true });
    }

    // Construct a beautiful prompt for Gemini
    const systemInstruction = `
You are the elite AI Briefing Director for "AI Design Studio", a premium design agency SaaS. 
Your goal is to guide the customer to build their design brief in a warm, inspirational, premium, and professional tone in Indonesian.
You are helping the user fill out the field: "${currentFieldName}".
The next field to fill after this is: "${nextFieldName}" ${options ? `with options: [${options.join(", ")}]` : ""}.
Here is what they have filled so far for the brief:
${JSON.stringify(answers, null, 2)}

Recent Conversation History:
${messages.slice(-6).map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join("\n")}

Guidelines:
1. Keep your reply friendly, modern, concise, and highly professional (1-3 sentences).
2. Give creative, brief praise or feedback on their last answer, indicating how that choice is great for their brand.
3. Prompt them clearly for the next field ("${nextFieldName}"). If there are specific suggestions or options, mention them nicely.
4. Speak Indonesian. Write directly, no "AI:" or system headers. Use subtle bold text if helpful.
5. If they uploaded a file (marked in message text as "[File: ...]"), acknowledge the file receipt with excitement.
`;

    const modelName = "gemini-2.5-flash";
    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: systemInstruction }]
        }
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 250,
      }
    });

    const replyText = response.text?.trim() || "";
    return res.json({ text: replyText, fallback: false });

  } catch (error: any) {
    console.error("Gemini API error in server:", error);
    return res.json({ fallback: true, error: error.message });
  }
});

// Serve health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Vite dev server middleware integration
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode (Vite middleware enabled)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode (Serving static assets from /dist)...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Design Studio server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});
