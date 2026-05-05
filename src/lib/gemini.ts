import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

export async function generatePitchVariation(
  leadName: string,
  agencyName: string,
  showreelTitle: string,
  showreelDesc: string
) {
  // Switching to 'gemini-pro' which is the most widely compatible model name
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    You are a high-end animation studio outreach expert for "Trickery".
    Generate a unique, short, and punchy email pitch for a potential lead.
    
    LEAD INFO:
    Name: ${leadName}
    Agency: ${agencyName}
    Showreel Focus: ${showreelTitle} (${showreelDesc})
    
    GUARDRAILS:
    1. Vary the greeting (don't always use "Hi" or "Hey").
    2. Vary the hook (mention their agency or a specific creative challenge).
    3. Vary the CTA (ask for a quick chat, a portfolio review, or just feedback).
    4. Keep it under 100 words.
    5. No placeholders like [Name]. Use the info provided.
    6. Tone: Professional but creative and slightly edgy (Studio aesthetic).
    
    Output only the email content.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
export async function generateEmailPersonalization(
  stage: string,
  subject: string,
  body: string,
  leadName: string,
  agencyName: string
) {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    You are an outreach expert for "Trickery", a premium animation studio based in South Africa.
    Rewrite the following outreach email to feel unique and personal for this specific recipient.
    Keep the same intent and length — just vary phrasing, tone, and hook so each send feels fresh.
    
    EMAIL STAGE: ${stage}
    ORIGINAL SUBJECT: "${subject}"
    ORIGINAL BODY: "${body}"
    
    RECIPIENT:
    Name: ${leadName}
    Agency: ${agencyName}
    
    RULES:
    1. Rewrite both the subject AND the body.
    2. Do NOT include a greeting like "Hi Daniel" — that is added separately.
    3. Keep the same overall length.
    4. Vary the subject line slightly — synonyms, different word order, same meaning.
    5. Tone: Creative, confident, South African studio aesthetic. Not salesy.
    6. Replace any placeholders like {name} or {company} with the actual recipient info provided.
    
    Respond ONLY in this exact JSON format, nothing else:
    {"subject": "...", "body": "..."}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().trim();
  const clean = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(clean);
  return { subject: parsed.subject as string, body: parsed.body as string };
}

