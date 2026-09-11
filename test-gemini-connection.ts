import { GoogleGenAI } from "@google/genai";

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("FAIL: GEMINI_API_KEY is not defined in environment");
    process.exit(1);
  }

  console.log("PASS: GEMINI_API_KEY is defined (length > 0)");

  const ai = new GoogleGenAI({ apiKey });
  
  // List models
  try {
    const list = await ai.models.list();
    console.log("Available models count:", list ? "Retrieved" : "Empty");
    for await (const m of list) {
      if (m.name?.includes("flash") || m.name?.includes("gemini")) {
        console.log("Model:", m.name);
      }
    }
  } catch (err) {
    console.log("List models error:", err instanceof Error ? err.message : String(err));
  }

  const models = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let success = false;

  for (const model of models) {
    try {
      console.log(`Testing model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: "Respond with the single word: READY",
      });
      const text = response.text?.trim();
      console.log(`SUCCESS with ${model}: response = "${text}"`);
      success = true;
      break;
    } catch (err) {
      console.warn(`Model ${model} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  if (!success) {
    console.error("FAIL: Could not connect to any Gemini model");
    process.exit(1);
  }

  console.log("PASS: Real Gemini API connection verified successfully!");
}

run();
