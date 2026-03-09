type BuildPdfInput = {
  title: string;
  lines: string[];
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function chunkLines(lines: string[], perPage: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) {
    chunks.push(lines.slice(i, i + perPage));
  }
  return chunks.length ? chunks : [[]];
}

export function buildSimplePdf({ title, lines }: BuildPdfInput): string {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const lineHeight = 14;
  const startY = pageHeight - margin;
  const maxLinesPerPage = Math.max(1, Math.floor((pageHeight - margin * 2) / lineHeight) - 2);
  const pages = chunkLines([title, '', ...lines], maxLinesPerPage);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;

  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIds.push(pageId);

    const textLines = pageLines
      .map((line) => {
        const escaped = escapePdfText(line);
        return `(${escaped}) Tj\nT*`;
      })
      .join('\n');
    const contentStream = `BT
/F1 10 Tf
${lineHeight} TL
1 0 0 1 ${margin} ${startY} Tm
${textLines}
ET`;

    objects[pageId] = `${pageId} 0 obj
<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>
endobj
`;
    objects[contentId] = `${contentId} 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
`;
  }

  objects[catalogId] = `${catalogId} 0 obj
<< /Type /Catalog /Pages ${pagesId} 0 R >>
endobj
`;
  objects[pagesId] = `${pagesId} 0 obj
<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>
endobj
`;
  objects[fontId] = `${fontId} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i += 1) {
    const object = objects[i];
    if (!object) continue;
    offsets[i] = pdf.length;
    pdf += object;
  }
  const xrefStart = pdf.length;
  pdf += `xref
0 ${objects.length}
0000000000 65535 f 
`;
  for (let i = 1; i < objects.length; i += 1) {
    const offset = offsets[i] || 0;
    pdf += `${String(offset).padStart(10, '0')} 00000 n 
`;
  }
  pdf += `trailer
<< /Size ${objects.length} /Root ${catalogId} 0 R >>
startxref
${xrefStart}
%%EOF`;

  return pdf;
}
