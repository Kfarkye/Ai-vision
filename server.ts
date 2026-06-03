import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure express to handle large payloads (up to 10MB)
  // This is required to support the AI Vision iOS App's base64 image strings 
  // without hitting a 413 Payload Too Large error.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Routes
  app.post("/api/clean-text", async (req, res) => {
    try {
      const { prompt, imageBuffer, mimeType } = req.body;

      if (!prompt || !imageBuffer || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: prompt, imageBuffer, and mimeType." });
      }

      if (!mimeType.startsWith("image/")) {
        return res.status(415).json({ error: "Unsupported Media Type." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageBuffer,
                  mimeType: mimeType,
                },
              },
            ],
          },
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });

      return res.status(200).json({ text: response.text });
    } catch (error) {
      console.error("CleanText API Error:", error);
      return res.status(500).json({ error: "Failed to process the requested image." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
