import type { RegisteredCr } from '../lib/crEntities';

export type MarkPlacement = 'off' | 'all' | 'last';
type LetterOptions = {
  company: RegisteredCr;
  text: string;
  signature: MarkPlacement;
  stamp: MarkPlacement;
};

// Work in A4 points and render at roughly 216 DPI for crisp browser-shaped Arabic text.
const width = 595.28;
const height = 841.89;
const margin = 45;
const bodyTop = 132;
const bodyWidth = width - 2 * margin;
const lineHeight = 18;
const footerHeight = 81;
const bodyFont = '12px Arial, sans-serif';

function directionOf(text: string): CanvasDirection {
  const firstLetter = text.match(/\p{L}/u)?.[0];
  return firstLetter && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(firstLetter) ? 'rtl' : 'ltr';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const char of word) {
      if (ctx.measureText(line + char).width > maxWidth && line) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
  }
  return [...lines, line];
}

function loadImage(src: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (new URL(src, window.location.href).origin !== window.location.origin && !src.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load the company's ${label}.`));
    image.src = src;
  });
}

function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function createLetterHeadPdf({ company, text, signature, stamp }: LetterOptions) {
  const [renderer, logo, signatureImage, stampImage] = await Promise.all([
    import('@react-pdf/renderer'),
    company.logo_url ? loadImage(company.logo_url, 'logo') : null,
    signature !== 'off' ? loadImage(company.signature_url, 'signature') : null,
    stamp !== 'off' ? loadImage(company.stamp_url, 'seal') : null
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 3);
  canvas.height = Math.ceil(height * 3);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('PDF generation is unavailable in this browser.');
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.textBaseline = 'top';
  ctx.font = bodyFont;

  let paragraphDirection: CanvasDirection = 'ltr';
  const lines = text.trim().split(/\r\n?|\n/).flatMap(paragraph => {
    if (!paragraph.trim()) return [{ value: '', direction: paragraphDirection }];
    // Keep the same alignment on every wrapped line of the paragraph.
    paragraphDirection = directionOf(paragraph);
    ctx.direction = paragraphDirection;
    return wrap(ctx, paragraph, bodyWidth).map(value => ({ value, direction: paragraphDirection }));
  });
  const hasEveryPageMark = signature === 'all' || stamp === 'all';
  const hasLastPageMark = signature === 'last' || stamp === 'last';
  const capacity = (withFooter: boolean) =>
    Math.floor((height - margin - bodyTop - (withFooter ? footerHeight : 0)) / lineHeight);
  const normalLimit = capacity(hasEveryPageMark);
  const lastLimit = capacity(hasEveryPageMark || hasLastPageMark);
  const pages: (typeof lines)[] = [];
  let cursor = 0;
  while (lines.length - cursor > lastLimit) {
    const remaining = lines.length - cursor;
    const count = remaining <= normalLimit ? Math.ceil(remaining / 2) : Math.min(normalLimit, remaining - 1);
    pages.push(lines.slice(cursor, cursor + count));
    cursor += count;
  }
  pages.push(lines.slice(cursor));
  if (pages.length > 100) throw new Error('The letter exceeds 100 pages. Shorten it before downloading.');

  const { Document, Page, Image, pdf } = renderer;
  return pdf(
    <Document title={`Letter Head - ${company.cr_name}`}>
      {pages.map((page, index) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#000';
        if (logo) drawImage(ctx, logo, margin, margin, 68, 49);
        const headingX = logo ? margin + 80 : margin;
        const headingWidth = width - margin - headingX;
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillText(company.cr_name, headingX, margin, headingWidth);
        ctx.direction = 'rtl';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillText(company.cr_name_ar || '', headingX, margin + 23, headingWidth);
        ctx.direction = 'ltr';
        ctx.font = '8px Arial, sans-serif';
        const details = [company.cr_number && `CR ${company.cr_number}`, company.phone, company.email].filter(Boolean);
        ctx.fillText(details.join('  ·  '), headingX, margin + 46, headingWidth);
        ctx.beginPath();
        ctx.moveTo(margin, 111);
        ctx.lineTo(width - margin, 111);
        ctx.stroke();

        ctx.font = bodyFont;
        page.forEach(({ value, direction }, line) => {
          ctx.direction = direction;
          ctx.textAlign = direction === 'rtl' ? 'right' : 'left';
          ctx.fillText(value, direction === 'rtl' ? width - margin : margin, bodyTop + line * lineHeight);
        });

        const last = index === pages.length - 1;
        const show = (placement: MarkPlacement) => placement === 'all' || (placement === 'last' && last);
        const footerY = height - margin - 65;
        if (signatureImage && show(signature)) drawImage(ctx, signatureImage, margin, footerY, 130, 65);
        if (stampImage && show(stamp)) drawImage(ctx, stampImage, width - margin - 145, footerY, 145, 65);

        return <Page key={index} size={[width, height]}>
          <Image src={canvas.toDataURL('image/png')} style={{ width, height }} />
        </Page>;
      })}
    </Document>
  ).toBlob();
}
