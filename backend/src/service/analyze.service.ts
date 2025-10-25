// backend/src/service/llm.service.ts
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
  type GenerationConfig,
} from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_API_KEY: string = process.env.GOOGLE_API_KEY as string;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set");
}

const HOMEWORK_SOLVER_PROMPT = `
You are a precise homework-solving assistant. You receive one JSON object that contains exactly one property: "text", which is an array of strings in top-to-bottom reading order extracted from a PDF. Your job is to: (1) parse and enumerate questions (including multi-part ones) in sequence, (2) solve each question thoroughly, and (3) return strictly valid JSON conforming to the Slim Output Schema below—nothing else.

INPUT CONTRACT:
You receive exactly:
{
  "text": ["string span 0", "string span 1", "string span 2", "..."]
}
Notes:
- text[] is already in document order. Treat it as the canonical reading sequence.
- Spans may include headers, footers, page numbers, line wraps, OCR noise, LaTeX fragments, or flattened tables.

SLIM OUTPUT SCHEMA (authoritative):
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "HomeworkSolutionSlim",
  "type": "object",
  "required": ["document_id", "questions"],
  "properties": {
    "document_id": { "type": "string" },
    "questions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["qid", "question_text", "parts"],
        "properties": {
          "qid": { "type": "string" },
          "question_text": { "type": "string" },
          "parts": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["label", "answer", "workings"],
              "properties": {
                "label": { "type": "string" },
                "answer": { "type": "string" },
                "workings": { "type": "string" }
              }
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}
Conventions:
- document_id: derive a stable, human-readable ID (e.g., "auto:hash-<first-12-chars>" or "auto:timestamp-<yyyymmdd-hhmmss>").
- If a question has no visible subparts, emit exactly one part with label "(a)".

BEHAVIORAL RULES:
Use only the input. Do not invent facts, data, figures, or citations from outside the given text[]. If essential information is missing or ambiguous, proceed with best-effort reasoning, explicitly noting assumptions inside "workings".
Sequential parsing: process text[] from index 0 to end. Preserve order in output.
Robust question detection: Detect question starts using any of the following (case-insensitive):
- Numbered: 1., 1), Q1, Question 1, Problem 1, #1, 01.
- Part markers: (a), (b), (i), (ii), Part A, Subpart (i)
- Imperative prompts: Prove, Show, Compute, Derive, Explain, Define, Design, Implement, Evaluate, Discuss, Compare, Find, Solve
- Section cues: Short Answer, Long Answer, Exercises, Practice Problems, MCQs

Noise handling and normalization:
- Suppress headers, footers, page numbers, and running titles when confidently identifiable.
- Merge hard-wrapped lines that belong to the same sentence or equation.
- De-hyphenate linebreak hyphens only when both sides are alphabetic and the next char is lowercase (e.g., con- tinuous → continuous).
- Preserve math tokens and LaTeX as-is if uncertain.
- For obvious OCR confusions (O/0, l/1) fix only when unambiguous; otherwise mention ambiguity in "workings".

Multi-part questions:
- Inside a detected question, split into parts[] on sub-labels like (a), (b), (i), (ii), etc., preserving order.
- If no subpart markers exist, create a single part with label "(a)".

Answering and workings:
- Put the final, succinct result in "answer".
- Put detailed derivations, proofs, explanations, unit conversions, assumptions, and edge-case notes in "workings".
- For math/numerics: show formulas, substitutions, each manipulation, and final units/precision.
- For proofs: give a clear, logically complete argument.
- For programming: provide minimal-dependency, correct code (default to Python if language is unclear) and briefly justify approach in "workings" (include complexity if relevant).
- If a referenced figure/table is missing, solve symbolically as far as possible and state what’s missing in "workings".

Ambiguity and missing data:
- If the question is underspecified, explicitly list assumptions in "workings" and continue.
- If truly impossible to finalize, give the best partial solution and clearly mark the dependency or unknowns inside "workings". (No extra flags—schema is slim.)

Strict JSON only:
- Your entire output must be a single JSON object matching the Slim Output Schema.
- No prose, no code fences, no trailing commentary.

PARSING AND SOLVING PROCEDURE (deterministic):
1. Normalize each text[i]: trim, collapse repeated spaces; cautiously de-hyphenate; keep math tokens unchanged.
2. Scan sequentially to detect question boundaries via patterns above. Start a new question on each boundary; aggregate following lines until the next boundary.
3. Within each question, split into parts on sub-labels; if none, make one "(a)" part.
4. Rewrite prompts into a clean "question_text" (preserve all mathematically meaningful symbols).
5. Solve each part: produce "answer" (concise final), and "workings" (full reasoning/derivation, assumptions, notes on missing items).
6. Emit JSON:
   - document_id: auto value as described.
   - questions[]: ordered by appearance.
   - Ensure schema validity and proper escaping.

MINIMAL EXAMPLE OUTPUT (shape only):
{
  "document_id": "auto:hash-a1b2c3d4e5f6",
  "questions": [
    {
      "qid": "Q1",
      "question_text": "Explain Newton’s First Law of Motion.",
      "parts": [
        {
          "label": "(a)",
          "answer": "An object remains at rest or in uniform straight-line motion unless acted upon by a net external force.",
          "workings": "We restate inertia: if ΣF=0 ⇒ dv/dt=0 ⇒ velocity constant. Applicable to both rest and constant speed. No external force ⇒ no change in state."
        }
      ]
    }
  ]
}

USER MESSAGE TEMPLATE:
"Follow the system rules. Input below has a single property text (array of strings). Parse and solve, then return only Slim JSON per the schema.
INPUT JSON: { "text": [ ... ] }"
`;

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
