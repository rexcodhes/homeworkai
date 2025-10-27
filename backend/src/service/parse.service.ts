import { PDFParse } from "pdf-parse";
import { ParsedResult } from "../types/parsedresult.types";

export async function parsePDF(buffer: Buffer): Promise<ParsedResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const { text } = result;
    return { text };
  } catch (e) {
    console.log("Error parsing PDF");
    throw new Error("Error parsing PDF");
  }
}
