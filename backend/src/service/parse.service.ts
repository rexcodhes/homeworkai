import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";

export async function parsePDF(pdfBuffer: Buffer) {
  const buffer = await readFile(pdfBuffer);

  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();
  return textResult;
}
