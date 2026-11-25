/**
 * Renders the "Relatório de ganhos" as an A4 PDF, in the browser (offline;
 * nothing leaves the device). pdf-lib is loaded on demand by the caller.
 */
import type { PDFFont, PDFPage } from "pdf-lib";
import { formatBRL } from "../money";
import type { EarningsReport } from "./earnings";

export type ReportPdfInput = {
  report: EarningsReport;
  driverName: string;
  /** "25/11/2026". */
  generatedOn: string;
};

/** Standard PDF fonts only cover WinAnsi: swap the few characters they lack. */
export function pdfSafe(text: string): string {
  return text
    .replace(/−/g, "-")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7e -ÿ—–•·]/g, "");
}

/** Splits text into lines that fit `width` at `size`. */
export function wrapText(
  text: string,
  font: Pick<PDFFont, "widthOfTextAtSize">,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const DISCLAIMER =
  "Valores registrados pelo próprio motorista no aplicativo Km+. Este relatório não é documento oficial da Uber, da 99 ou de outras plataformas, nem comprovante fiscal. Para confirmar os valores, peça os extratos nos aplicativos das plataformas. Km+ não é afiliado à Uber nem à 99.";

export async function renderEarningsPdf({
  report,
  driverName,
  generatedOn,
}: ReportPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Relatório de ganhos - ${report.periodLabel}`));
  doc.setCreator("Km+");
  doc.setProducer("Km+");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const INK = rgb(16 / 255, 24 / 255, 40 / 255);
  const MUTED = rgb(91 / 255, 100 / 255, 114 / 255);
  const LIME = rgb(198 / 255, 241 / 255, 53 / 255);
  const DIVIDER = rgb(230 / 255, 227 / 255, 218 / 255);
  const BG = rgb(244 / 255, 243 / 255, 238 / 255);

  const W = 595.28;
  const H = 841.89;
  const M = 48;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: typeof INK } = {},
  ) =>
    page.drawText(pdfSafe(s), {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? regular,
      color: opts.color ?? INK,
    });
  const right = (
    s: string,
    xRight: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: typeof INK } = {},
  ) => {
    const f = opts.font ?? regular;
    const size = opts.size ?? 10;
    text(s, xRight - f.widthOfTextAtSize(pdfSafe(s), size), yy, opts);
  };
  const newPageIfNeeded = (need: number) => {
    if (y - need > M + 60) return;
    page = doc.addPage([W, H]);
    y = H - M;
  };

  // Brand band.
  page.drawRectangle({ x: 0, y: H - 86, width: W, height: 86, color: LIME });
  text("Km+", M, H - 56, { size: 30, font: bold });
  right("Relatório de ganhos", W - M, H - 50, { size: 13, font: bold });
  right(`Gerado em ${generatedOn}`, W - M, H - 66, { size: 9 });
  y = H - 86 - 36;

  text("Relatório de ganhos", M, y, { size: 20, font: bold });
  y -= 20;
  text(report.periodLabel, M, y, { size: 12, color: MUTED });
  y -= 26;
  if (driverName.trim()) {
    text("Motorista", M, y, { size: 9, color: MUTED });
    text(driverName.trim(), M + 70, y, { size: 11, font: bold });
    y -= 26;
  }

  // Highlights.
  const boxes = [
    ["Ganhos no período", formatBRL(report.total.grossCents)],
    ["Média por mês", formatBRL(report.averageGrossCents)],
    ["Dias rodados", String(report.total.daysWorked)],
  ] as const;
  const gap = 10;
  const bw = (W - 2 * M - 2 * gap) / 3;
  boxes.forEach(([label, value], i) => {
    const x = M + i * (bw + gap);
    page.drawRectangle({
      x,
      y: y - 58,
      width: bw,
      height: 58,
      color: i === 0 ? LIME : BG,
    });
    text(label.toUpperCase(), x + 12, y - 20, {
      size: 8,
      font: bold,
      color: i === 0 ? INK : MUTED,
    });
    text(value, x + 12, y - 44, { size: 16, font: bold });
  });
  y -= 58 + 30;

  // Month table.
  const cols = [M, M + 215, W - M - 200, W - M - 100, W - M];
  const header = () => {
    text("MÊS", cols[0]!, y, { size: 8, font: bold, color: MUTED });
    right("DIAS", cols[1]!, y, { size: 8, font: bold, color: MUTED });
    right("GANHOS", cols[2]!, y, { size: 8, font: bold, color: MUTED });
    right("GASTOS E TAXAS", cols[3]!, y, {
      size: 8,
      font: bold,
      color: MUTED,
    });
    right("SOBROU", cols[4]!, y, { size: 8, font: bold, color: MUTED });
    y -= 10;
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 1,
      color: INK,
    });
    y -= 16;
  };
  header();
  for (const m of report.months) {
    newPageIfNeeded(24);
    const label = m.until
      ? `${m.label} (até ${m.until.slice(8, 10)}/${m.until.slice(5, 7)})`
      : m.label;
    text(label, cols[0]!, y, { size: 10 });
    right(String(m.daysWorked), cols[1]!, y);
    right(formatBRL(m.grossCents), cols[2]!, y, { font: bold });
    right(formatBRL(m.costsCents), cols[3]!, y, { color: MUTED });
    right(formatBRL(m.netCents), cols[4]!, y);
    y -= 9;
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.6,
      color: DIVIDER,
    });
    y -= 15;
  }
  newPageIfNeeded(24);
  text("Total", cols[0]!, y, { size: 11, font: bold });
  right(String(report.total.daysWorked), cols[1]!, y, { font: bold });
  right(formatBRL(report.total.grossCents), cols[2]!, y, { font: bold });
  right(formatBRL(report.total.costsCents), cols[3]!, y, {
    font: bold,
    color: MUTED,
  });
  right(formatBRL(report.total.netCents), cols[4]!, y, { font: bold });
  y -= 34;

  // Apps.
  if (report.apps.length > 0) {
    newPageIfNeeded(40 + report.apps.length * 20);
    text("GANHOS POR APLICATIVO", M, y, { size: 8, font: bold, color: MUTED });
    y -= 18;
    for (const a of report.apps) {
      text(a.name, M, y, { size: 10 });
      right(
        `${formatBRL(a.cents)}  ·  ${Math.round(a.share * 100)}%`,
        W / 2 + 60,
        y,
        { font: bold },
      );
      y -= 18;
    }
    y -= 10;
  }

  // Disclaimer at the bottom of the last page.
  const lines = wrapText(pdfSafe(DISCLAIMER), regular, 8.5, W - 2 * M);
  let fy = M + lines.length * 12;
  page.drawLine({
    start: { x: M, y: fy + 10 },
    end: { x: W - M, y: fy + 10 },
    thickness: 0.6,
    color: DIVIDER,
  });
  for (const l of lines) {
    page.drawText(l, { x: M, y: fy, size: 8.5, font: regular, color: MUTED });
    fy -= 12;
  }

  return doc.save();
}
