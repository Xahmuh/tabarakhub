const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function readWord(file: File) {
  const { default: JSZip } = await import('jszip');
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const body = archive.file('word/document.xml');
  if (!body) throw new Error('This file does not contain a Word document.');
  const xml = new DOMParser().parseFromString(await body.async('string'), 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('The Word document could not be read.');

  return Array.from(xml.getElementsByTagNameNS(wordNamespace, 'p'), paragraph =>
    Array.from(paragraph.getElementsByTagNameNS(wordNamespace, '*'), node => {
      if (node.localName === 't') return node.textContent ?? '';
      if (node.localName === 'tab') return '    ';
      if (node.localName === 'br' || node.localName === 'cr') return '\n';
      return '';
    }).join('')
  ).join('\n');
}

async function readPdf(file: File) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('Import a PDF with 100 pages or fewer.');
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = '';
      let previous: { y: number; height: number; endX: number; startX: number } | undefined;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [, , , , x, y] = item.transform;
        if (previous && Math.abs(y - previous.y) > Math.max(2, previous.height * 0.45)) {
          lines.push(line.trimEnd());
          line = '';
        } else if (line && previous && item.str && !/\s$/.test(line) && !/^\s/.test(item.str)) {
          const gap = item.dir === 'rtl' ? previous.startX - (x + item.width) : x - previous.endX;
          if (gap > Math.max(1, previous.height * 0.16)) line += ' ';
        }
        line += item.str;
        previous = { y, height: item.height, endX: x + item.width, startX: x };
        if (item.hasEOL) {
          lines.push(line.trimEnd());
          line = '';
          previous = undefined;
        }
      }
      if (line) lines.push(line.trimEnd());
      if (!lines.join('').trim()) {
        throw new Error(`Page ${number} has no selectable text. Paste its text into the letter editor.`);
      }
      pages.push(lines.join('\n').trim());
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally {
    await task.destroy();
  }
}

export async function importLetterText(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file up to 20 MB.');
  const name = file.name.toLowerCase();
  if (!name.endsWith('.docx') && !name.endsWith('.pdf')) {
    throw new Error('Choose a Word (.docx) or PDF (.pdf) file.');
  }
  const text = (await (name.endsWith('.pdf') ? readPdf(file) : readWord(file))).trim();
  if (!text) throw new Error('The file does not contain readable text.');
  return text;
}
