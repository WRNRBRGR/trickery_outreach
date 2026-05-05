"use server";

import { generatePitchVariation, generateEmailPersonalization } from "@/lib/gemini";


export async function getPitch(
  leadName: string,
  agencyName: string,
  showreelTitle: string,
  showreelDesc: string
) {
  try {
    const pitch = await generatePitchVariation(
      leadName,
      agencyName,
      showreelTitle,
      showreelDesc
    );
    return { success: true, pitch };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, error: "Failed to generate variation" };
  }
}

export async function getVariation(
  stage: string,
  subject: string,
  body: string,
  leadName: string,
  agencyName: string
) {
  try {
    const result = await generateEmailPersonalization(
      stage,
      subject,
      body,
      leadName,
      agencyName
    );
    return { success: true, subject: result.subject, body: result.body };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, error: "Failed to generate variation" };
  }
}

export async function recomposeEmail(
  stage: string,
  subject: string,
  body: string,
  leadName: string,
  agencyName: string
) {
  try {
    const result = await generateEmailPersonalization(stage, subject, body, leadName, agencyName);
    return { success: true, subject: result.subject, body: result.body };
  } catch (error: any) {
    console.error("AI Recompose Error:", error);
    // Extract a useful message — rate limits, auth errors etc.
    const msg: string = error?.message || "Unknown error";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many")) {
      return { 
        success: false, 
        error: "Gemini API rate limit reached. If you've waited a minute and still see this, you may have reached your daily free limit (1,500 requests). You can check your quota at aistudio.google.com." 
      };
    }
    if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
      return { success: false, error: "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local." };
    }
    return { success: false, error: `AI error: ${msg.substring(0, 120)}` };
  }
}



