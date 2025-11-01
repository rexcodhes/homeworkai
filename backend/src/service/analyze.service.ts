// backend/src/service/llm.service.ts
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
  type GenerationConfig,
} from "@google/generative-ai";
import dotenv from "dotenv";
import { HOMEWORK_SOLVER_PROMPT } from "../utils/prompt.utils";

dotenv.config();

const GOOGLE_API_KEY: string = process.env.GOOGLE_API_KEY as string;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set");
}

const outputSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    document_id: { type: SchemaType.STRING },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          qid: { type: SchemaType.STRING },
          question_text: { type: SchemaType.STRING },
          parts: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                label: { type: SchemaType.STRING },
                answer: { type: SchemaType.STRING },
                workings: { type: SchemaType.STRING },
              },
              required: ["label", "answer", "workings"],
            },
          },
        },
        required: ["qid", "question_text", "parts"],
      },
    },
  },
  required: ["document_id", "questions"],
};

const generationConfig: GenerationConfig = {
  temperature: 0.2,
  maxOutputTokens: 8000,
  responseMimeType: "application/json",
  responseSchema: outputSchema,
};

const llm = new GoogleGenerativeAI(GOOGLE_API_KEY);

export type SlimSolution = {
  document_id: string;
  questions: Array<{
    qid: string;
    question_text: string;
    parts: Array<{
      label: string;
      answer: string;
      workings: string;
    }>;
  }>;
};

export async function runLLM(pdfData: string): Promise<SlimSolution> {
  // pdfData is expected to be a JSON string like: {"text": ["...", "...", "..."]}
  const model = llm.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig,
  });

  const prompt = `${HOMEWORK_SOLVER_PROMPT}\n\nINPUT JSON: ${pdfData}`;

  console.log("prompt: ", prompt);
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  console.log(res);

  const text = res.response.text();
  console.log("LLM Raw Output:", text);
  try {
    return JSON.parse(text) as SlimSolution;
  } catch {
    throw new Error("LLM returned non-JSON output");
  }
}
