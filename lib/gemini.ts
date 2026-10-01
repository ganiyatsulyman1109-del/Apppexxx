import { GoogleGenerativeAI } from "@google/generative-ai"

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set")
  }
  return new GoogleGenerativeAI(apiKey)
}

export async function generateText(prompt: string, maxTokens = 500): Promise<string> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  })
  const response = await result.response
  return response.text()
}
