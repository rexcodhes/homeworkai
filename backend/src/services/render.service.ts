import pdfkit from "pdfkit";
import { PassThrough } from "stream";
import { AnalysisOutput } from "../types/analysis-output.types";

export function renderOutputToPdfStream(slim: AnalysisOutput) {
  const doc = new pdfkit({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const stream = new PassThrough();
  doc.pipe(stream);

  let pages = 1;
  doc.on("pageAdded", () => {
    pages += 1;

    doc
      .fontSize(9)
      .fillColor("#444")
      .text(slim.document_id, 50, 30, {
        width: doc.page.width - 100,
        align: "right",
      });
  });

  doc
    .fontSize(20)
    .fillColor("#000")
    .text("Homework Solution", { align: "center" })
    .moveDown(0.5);
  doc.fontSize(10).fillColor("#555").text(`Document ID: ${slim.document_id}`, {
    align: "center",
  });
  doc.moveDown(1.5);

  for (const q of slim.questions || []) {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#000")
      .text(`${q.qid} — ${q.question_text}`);
    doc.moveDown(0.4);

    for (const p of q.parts || []) {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`${p.label} Answer: ${p.answer}`);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#222")
        .moveDown(0.2)
        .text(p.workings, {
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
        })
        .moveDown(0.6);
    }

    doc.moveDown(0.8);
  }

  doc.end();

  const done = new Promise<{ pages: number }>((resolve, reject) => {
    stream.on("finish", () => resolve({ pages }));
    stream.on("error", reject);
  });

  return { stream, done };
}

export async function renderSlimToPdfBuffer(slim: AnalysisOutput) {
  const { stream, done } = renderOutputToPdfStream(slim);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    );
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const { pages } = await done;
  return { buffer: Buffer.concat(chunks), pages };
}
