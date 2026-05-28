import { connectToDatabase } from "@/lib/MongoDB";

/**
 * Returns the active Groq API key from the database.
 * Falls back to GROQ_API_KEY env var if no active key is set in DB.
 */
export async function getGroqKey(): Promise<string> {
  try {
    const db  = await connectToDatabase();
    const doc = await db.collection("ai_credentials").findOne({
      provider: "groq",
      isActive: true,
    });
    if (doc?.apiKey) return doc.apiKey as string;
  } catch {
    // DB unavailable — fall through to env
  }
  // Fallback to environment variable
  const envKey = process.env.GROQ_API_KEY;
  if (!envKey) throw new Error("No active Groq API key found. Add one in Settings → AI Credentials.");
  return envKey;
}
