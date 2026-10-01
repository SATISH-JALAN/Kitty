"use client";
/**
 * "Share card as image" (brief 13.4, P2): the host wizard's invite card drawn onto a
 * 1080×1440 canvas (3:4, the card's own aspect) as a PNG to post in a group chat.
 *
 * It reuses what the live preview already has on screen: the painted vignette
 * (a decoded <img>), the party emblem and the wordmark (self-contained SVGs), and the
 * page's own fonts. The card carries no link and no QR code: the invite secret lives
 * only in the link, so the image is safe to post anywhere.
 */

export interface ShareCardInput {
  /** "You're invited" */
  invited: string;
  title: string;
  word: string;
  /** The plain lines under the divider (amounts, then fees), one per row. */
  lines: string[];
  /** Bottom line, e.g. "Devnet · test funds only". */
  footnote: string;
  art: HTMLImageElement | null;
  emblem: SVGSVGElement | null;
  wordmark: SVGSVGElement | null;
}

const W = 1080;
const H = 1440;

function token(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** #rrggbb + alpha → rgba(); anything else falls back to the brief's marigold. */
function rgba(hex: string, a: number) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const [r, g, b] = m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16)) : [244, 163, 0];
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

async function svgToImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const c = svg.cloneNode(true) as SVGSVGElement;
  c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  c.setAttribute("width", String(width));
  c.setAttribute("height", String(height));
  c.removeAttribute("class");
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(c))}`;
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function readyImage(img: HTMLImageElement | null) {
  if (!img) return null;
  try {
    if (!img.complete || !img.naturalWidth) await img.decode();
    return img.naturalWidth ? img : null;
  } catch {
    return null;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** Arch window: a rectangle with a semicircular top (brief 5.6), as in the preview. */
function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const night = token("--night", "#170e22");
  const paperDeep = token("--paper-deep", "#e6d6bd");
  const ink = token("--ink", "#22151f");
  const inkSoft = token("--ink-soft", "#5a4652");
  const gold = token("--gold", "#c8a04a");
  const moonSoft = token("--moon-soft", "#bfafc4");
  const marigold = token("--marigold", "#f4a300");
  const serif = token("--font-boska", "Georgia, serif");
  const sans = token("--font-switzer", "system-ui, sans-serif");
  const mono = token("--font-fragment", "ui-monospace, monospace");

  await Promise.all([
    document.fonts.load(`500 58px ${serif}`),
    document.fonts.load(`italic 400 76px ${serif}`),
    document.fonts.load(`600 24px ${sans}`),
    document.fonts.load(`400 26px ${mono}`),
  ]).catch(() => {});

  const [art, emblem, wordmark] = await Promise.all([
    readyImage(input.art),
    input.emblem ? svgToImage(input.emblem, 300, 300).catch(() => null) : null,
    input.wordmark
      ? svgToImage(input.wordmark, Math.round((64 * input.wordmark.viewBox.baseVal.width) / input.wordmark.viewBox.baseVal.height), 64).catch(() => null)
      : null,
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Night field with lantern light pooling behind the card.
  ctx.fillStyle = night;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 760);
  glow.addColorStop(0, rgba(marigold, 0.25));
  glow.addColorStop(1, rgba(marigold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Wordmark, top centre.
  if (wordmark) ctx.drawImage(wordmark, (W - wordmark.width) / 2, 72, wordmark.width, wordmark.height);

  // The card: paper-deep, lifted, with the double gold foil rule.
  const cx = 140;
  const cy = 196;
  const cw = 800;
  const ch = 1066;
  ctx.save();
  ctx.shadowColor = "rgba(7, 3, 12, 0.55)";
  ctx.shadowBlur = 56;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = paperDeep;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.restore();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx + 22, cy + 22, cw - 44, ch - 44);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx + 32, cy + 32, cw - 64, ch - 64);

  const mid = W / 2;
  let y = cy + 76;
  // A two-line title borrows its room from the arch and the emblem, so the fee lines stay inside the frame.
  ctx.font = `500 58px ${serif}`;
  const titleLines = wrap(ctx, input.title, 640, 2);
  const tight = titleLines.length > 1;

  // Vignette in an arch window (same order as the live preview: arch, label, title).
  const aw = tight ? 208 : 230;
  const ah = tight ? 290 : 322;
  if (art) {
    ctx.save();
    archPath(ctx, mid - aw / 2, y, aw, ah);
    ctx.clip();
    drawCover(ctx, art, mid - aw / 2, y, aw, ah);
    ctx.restore();
    archPath(ctx, mid - aw / 2, y, aw, ah);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    y += ah + 58;
  } else {
    y += 40;
  }

  ctx.fillStyle = inkSoft;
  ctx.font = `600 24px ${sans}`;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "3px";
  ctx.fillText(input.invited.toUpperCase(), mid, y);
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  y += 76;

  // Party title.
  ctx.fillStyle = ink;
  ctx.font = `500 58px ${serif}`;
  for (const line of titleLines) {
    ctx.fillText(line, mid, y);
    y += 66;
  }

  // Emblem.
  const es = tight ? 112 : 150;
  if (emblem) {
    ctx.drawImage(emblem, mid - es / 2, y - 20, es, es);
    y += es + 50;
  } else {
    y += 30;
  }

  // Tradition word.
  ctx.font = `italic 400 76px ${serif}`;
  const word = wrap(ctx, input.word, 660, 1)[0] ?? "";
  ctx.fillText(word, mid, y);
  y += 44;

  // Stitched divider.
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 9]);
  ctx.beginPath();
  ctx.moveTo(mid - 280, y);
  ctx.lineTo(mid + 280, y);
  ctx.stroke();
  ctx.restore();
  y += 58;

  // The plain lines: amounts and fees exactly as the preview shows them.
  ctx.fillStyle = ink;
  ctx.font = `400 26px ${mono}`;
  for (const line of input.lines) {
    for (const part of wrap(ctx, line, 680, 2)) {
      ctx.fillText(part, mid, y);
      y += 40;
    }
  }

  // Devnet label under the card.
  ctx.fillStyle = moonSoft;
  ctx.font = `400 24px ${mono}`;
  ctx.fillText(input.footnote, mid, cy + ch + 92);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the image."))), "image/png"));
}

/** Share sheet with the PNG where the browser supports files; otherwise a download. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";
      // Share failed for another reason (e.g. activation expired): fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
