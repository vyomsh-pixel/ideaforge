import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | null = null;
let _cachedKey: string | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  if (!_gemini || _cachedKey !== apiKey) {
    _gemini = new GoogleGenAI({ apiKey });
    _cachedKey = apiKey;
  }
  return _gemini;
}

export async function callGemini(
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      abortSignal: AbortSignal.timeout(45_000),
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}
