import { PDFParse } from "pdf-parse";

export async function parsePDF(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const { text, pages } = result;
    return { text, pages };
  } catch (e) {
    console.log("Error parsing PDF");
    return e;
  }
}
