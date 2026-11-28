import type { RegisteredCr } from '../lib/crEntities';

export type MarkPlacement = 'off' | 'all' | 'last';
export type HeaderStyle = 'company' | 'none';
export type MarkKind = 'signature' | 'stamp' | 'date';
type LetterMark = { kind: MarkKind; placement: MarkPlacement | 'first'; src: string | null };
export type MarkPosition = { x: number; y: number };
export type PageMarkPositions = Partial<Record<number, Partial<Record<MarkKind, MarkPosition>>>>;
export type ParagraphStyle = { bold: boolean; alignment: 'auto' | 'left' | 'center' | 'right'; size: number };
export type ParagraphStyles = Partial<Record<number, ParagraphStyle>>;
type LetterOptions = {
  company: RegisteredCr;
  header: HeaderStyle;
  showAddressFooter: boolean;
  showDate: boolean;
  text: string;
  signature: MarkPlacement;
  stamp: MarkPlacement;
  fitToOnePage: boolean;
  paragraphStyles: ParagraphStyles;
};

// Work in A4 points and render at roughly 216 DPI for crisp browser-shaped Arabic text.
export const letterPageSize = { width: 595.28, height: 841.89 };
const { width, height } = letterPageSize;
const margin = 45;
const bodyWidth = width - 2 * margin;
const footerHeight = 81;
export const minimumFontSize = 9;
export const maximumFontSize = 32;
export const defaultParagraphStyle: ParagraphStyle = { bold: false, alignment: 'auto', size: 12 };
export const splitLetterParagraphs = (text: string) => text.split(/\r\n?|\n/);
const bodyFont = (size: number, bold: boolean) => `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
export const markSizes = {
  signature: { width: 130, height: 65 },
  stamp: { width: 145, height: 65 },
  date: { width: 112, height: 22 }
};
export const defaultMarkPositions: Record<MarkKind, MarkPosition> = {
  signature: { x: margin, y: height - margin - markSizes.signature.height },
  stamp: { x: width - margin - markSizes.stamp.width, y: height - margin - markSizes.stamp.height },
  date: { x: width - margin - markSizes.date.width, y: margin }
};

export function getMarkPosition(positions: PageMarkPositions, pageIndex: number, kind: MarkKind, dateTop = margin) {
  const fallback = defaultMarkPositions[kind];
  return positions[pageIndex]?.[kind] ?? (kind === 'date' ? { ...fallback, y: dateTop } : fallback);
}

export function clampMarkPosition(kind: MarkKind, { x, y }: MarkPosition): MarkPosition {
  const size = markSizes[kind];
  return {
    x: Math.max(0, Math.min(width - size.width, x)),
    y: Math.max(0, Math.min(height - size.height, y))
  };
}

export function markShowsOnPage(placement: LetterMark['placement'], index: number, pageCount: number) {
  return placement === 'all' || (placement === 'last' && index === pageCount - 1) ||
    (placement === 'first' && index === 0);
}

function directionOf(text: string): CanvasDirection {
  const firstLetter = text.match(/\p{L}/u)?.[0];
  return firstLetter && /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(firstLetter) ? 'rtl' : 'ltr';
}

const groupFooterAddresses: Record<string, string> = {
  '127506': 'Flat/Shop 0, Building 775, Road 77, Block 729, Jerdab, Kingdom of Bahrain',
  '106723': 'Flat/Shop 0, Building 109J, Road 11, Block 711, Tubli, Kingdom of Bahrain',
  '145842': 'Flat/Shop 0, Building 69A, Road 45, Block 743, Sanad, Kingdom of Bahrain',
  '172593': 'Flat/Shop 4, Building 1255, Road 1725, Block 1017, Damistan, Kingdom of Bahrain'
};

function companyFooterAddress(company: RegisteredCr) {
  for (const cr of [company.cr_number, company.parent_cr_number]) {
    const group = cr?.trim().match(/^(\d+)(?:\s*[-–]\s*\d+)?$/)?.[1];
    const address = group && groupFooterAddresses[group];
    if (address) return address;
  }
  const address = company.address_en?.trim() || '';
  if (!address || /^(?:kingdom of )?bahrain[.,]*$/i.test(address) || /\p{Script=Arabic}/u.test(address)) return '';
  return address;
}

function drawFooterDivider(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(margin, height - 42);
  ctx.lineTo(width - margin, height - 42);
  ctx.stroke();
  ctx.restore();
}

function drawAddressFooter(ctx: CanvasRenderingContext2D, address: string) {
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.9;
  ctx.font = '9px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  const iconWidth = 9;
  const gap = 6;
  const textMax = bodyWidth - iconWidth - gap;
  const textWidth = Math.min(ctx.measureText(address).width, textMax);
  const left = (width - textWidth - iconWidth - gap) / 2;
  const pinX = left + iconWidth / 2;
  const textX = left + iconWidth + gap;
  const y = height - 31;
  ctx.beginPath();
  ctx.moveTo(pinX, y + 5);
  ctx.bezierCurveTo(pinX - 2, y + 2, pinX - 4, y, pinX - 4, y - 2);
  ctx.arc(pinX, y - 2, 4, Math.PI, 0);
  ctx.bezierCurveTo(pinX + 4, y, pinX + 2, y + 2, pinX, y + 5);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pinX, y - 2, 1.15, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillText(address, textX, y, textMax);
  ctx.restore();
}

function drawPageNumber(ctx: CanvasRenderingContext2D, page: number, total: number, hasAddress: boolean) {
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = '8px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.fillText(`Page ${page} of ${total}`, width / 2, height - (hasAddress ? 18 : 31));
  ctx.restore();
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

export const letterheadBandHeight = 122;

function drawCompanyLetterhead(ctx: CanvasRenderingContext2D, company: RegisteredCr, logo: HTMLImageElement | null) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
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
  ctx.restore();
}

export async function renderCompanyLetterhead(company: RegisteredCr) {
  const logo = company.logo_url ? await loadImage(company.logo_url, 'logo') : null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 3);
  canvas.height = letterheadBandHeight * 3;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser cannot render the letterhead.');
  ctx.scale(canvas.width / width, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, letterheadBandHeight);
  drawCompanyLetterhead(ctx, company, logo);
  return canvas.toDataURL('image/png');
}

function renderMark(kind: MarkKind, image: HTMLImageElement | null) {
  if (!image) return null;
  const size = markSizes[kind];
  const canvas = document.createElement('canvas');
  canvas.width = size.width * 3;
  canvas.height = size.height * 3;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF generation is unavailable in this browser.');
  ctx.scale(3, 3);
  drawImage(ctx, image, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/png');
}

function renderTodayDate() {
  const { width, height } = markSizes.date;
  const canvas = document.createElement('canvas');
  canvas.width = width * 3;
  canvas.height = height * 3;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF generation is unavailable in this browser.');
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bahrain', day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date());
  ctx.scale(3, 3);
  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Date: ${date}`, width - 1, height / 2);
  return canvas.toDataURL('image/png');
}

export async function loadLetterMarks(company: RegisteredCr, signature: MarkPlacement, stamp: MarkPlacement, showDate = false): Promise<LetterMark[]> {
  const [signatureImage, stampImage] = await Promise.all([
    signature !== 'off' ? loadImage(company.signature_url, 'signature') : null,
    stamp !== 'off' ? loadImage(company.stamp_url, 'seal') : null
  ]);
  const marks: LetterMark[] = [
    { kind: 'signature', placement: signature, src: renderMark('signature', signatureImage) },
    { kind: 'stamp', placement: stamp, src: renderMark('stamp', stampImage) }
  ];
  if (showDate) marks.push({ kind: 'date', placement: 'first', src: renderTodayDate() });
  return marks;
}

export async function renderLetterHeadPages({ company, header, showAddressFooter, showDate, text, signature, stamp, fitToOnePage, paragraphStyles }: LetterOptions) {
  const showHeader = header === 'company';
  const bodyTop = showHeader ? 132 : margin;
  const [logo, marks] = await Promise.all([
    showHeader && company.logo_url ? loadImage(company.logo_url, 'logo') : null,
    loadLetterMarks(company, signature, stamp, showDate)
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 3);
  canvas.height = Math.ceil(height * 3);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('PDF generation is unavailable in this browser.');
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.textBaseline = 'top';
  const hasEveryPageMark = signature === 'all' || stamp === 'all';
  const hasLastPageMark = signature === 'last' || stamp === 'last';
  const paragraphs = splitLetterParagraphs(text);
  const first = paragraphs.findIndex(paragraph => paragraph.trim());
  if (first < 0) throw new Error('Enter some letter text before generating a PDF.');
  const footerAddress = showAddressFooter ? companyFooterAddress(company) : '';
  let end = paragraphs.length;
  while (end > first && !paragraphs[end - 1].trim()) end--;
  const normalLimit = height - margin - bodyTop - (hasEveryPageMark ? footerHeight : 0);
  const lastLimit = height - margin - bodyTop - (hasEveryPageMark || hasLastPageMark ? footerHeight : 0);
  const dateSpace = showDate ? markSizes.date.height + 4 : 0;
  const measure = (scale: number) => {
    let totalHeight = 0;
    const lines = paragraphs.slice(first, end).flatMap((paragraph, index) => {
      const style = paragraphStyles[index + first] ?? defaultParagraphStyle;
      const size = Math.max(minimumFontSize, Math.round(style.size * scale * 2) / 2);
      const lineHeight = size * 1.5;
      const font = bodyFont(size, style.bold);
      const direction = directionOf(paragraph);
      const alignment = style.alignment === 'auto' ? (direction === 'rtl' ? 'right' : 'left') : style.alignment;
      ctx.font = font;
      ctx.direction = direction;
      return wrap(ctx, paragraph, bodyWidth).map(value => {
        totalHeight += lineHeight;
        return { value, direction, alignment, font, lineHeight, size };
      });
    });
    return { lines, totalHeight };
  };
  let layout = measure(1);
  for (let step = 23; fitToOnePage && layout.totalHeight > lastLimit - dateSpace && step >= 6; step--) {
    layout = measure(step / 24);
    if (layout.lines.every(line => line.size === minimumFontSize)) break;
  }
  const { lines } = layout;
  const pages: (typeof lines)[] = [];
  let cursor = 0;
  let remainingHeight = layout.totalHeight;
  while (remainingHeight > lastLimit - (cursor === 0 ? dateSpace : 0)) {
    const pageLimit = normalLimit - (cursor === 0 ? dateSpace : 0);
    const limit = remainingHeight <= pageLimit ? remainingHeight / 2 : pageLimit;
    let endOfPage = cursor;
    let used = 0;
    while (endOfPage < lines.length - 1 && used + lines[endOfPage].lineHeight <= limit) {
      used += lines[endOfPage].lineHeight;
      endOfPage++;
    }
    pages.push(lines.slice(cursor, endOfPage));
    if (pages.length >= 100) throw new Error('The letter exceeds 100 pages. Shorten it before downloading.');
    cursor = endOfPage;
    remainingHeight -= used;
  }
  pages.push(lines.slice(cursor));

  const pageImages = pages.map((page, index) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    if (showHeader) drawCompanyLetterhead(ctx, company, logo);

    let y = bodyTop + (index === 0 ? dateSpace : 0);
    page.forEach(({ value, direction, alignment, font, lineHeight }) => {
      ctx.font = font;
      ctx.direction = direction;
      ctx.textAlign = alignment;
      const x = alignment === 'center' ? width / 2 : alignment === 'right' ? width - margin : margin;
      ctx.fillText(value, x, y);
      y += lineHeight;
    });
    if (footerAddress || pages.length > 1) drawFooterDivider(ctx);
    if (footerAddress) drawAddressFooter(ctx, footerAddress);
    if (pages.length > 1) drawPageNumber(ctx, index + 1, pages.length, Boolean(footerAddress));

    return canvas.toDataURL('image/png');
  });
  const sizes = lines.map(line => line.size);
  const smallest = sizes.reduce((min, value) => Math.min(min, value), maximumFontSize);
  const largest = sizes.reduce((max, value) => Math.max(max, value), minimumFontSize);
  return {
    pageImages,
    dateTop: bodyTop,
    fontSizeLabel: smallest === largest ? String(largest) : `${smallest}–${largest}`,
    marks
  };
}

export async function createLetterHeadPdf(
  companyName: string,
  { pageImages, marks, dateTop }: Awaited<ReturnType<typeof renderLetterHeadPages>>,
  positions: PageMarkPositions
) {
  const { Document, Page, Image, pdf } = await import('@react-pdf/renderer');
  return pdf(
    <Document title={`Letter Head - ${companyName}`}>
      {pageImages.map((src, index) => (
        <Page key={index} size={[width, height]} wrap={false}>
          <Image src={src} style={{ width, height }} />
          {marks.map(mark => {
            if (!mark.src || !markShowsOnPage(mark.placement, index, pageImages.length)) return null;
            const { x, y } = getMarkPosition(positions, index, mark.kind, dateTop);
            return <Image key={mark.kind} src={mark.src}
              style={{ position: 'absolute', left: x, top: y, ...markSizes[mark.kind] }} />;
          })}
        </Page>
      ))}
    </Document>
  ).toBlob();
}
