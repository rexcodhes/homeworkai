export function splitText(text: string, chunkSize: number) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize;
  }
  return chunks;
}
