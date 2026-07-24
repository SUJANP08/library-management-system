import * as THREE from "three";

function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function shade(hex: number, amt: number) {
  const col = new THREE.Color(hex);
  if (amt >= 0) col.lerp(new THREE.Color(0xffffff), amt);
  else col.lerp(new THREE.Color(0x000000), -amt);
  return `#${col.getHexString()}`;
}

let seed = 1;
function rand() {
  // simple deterministic-ish PRNG so textures don't churn on every re-render
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function finish(tex: THREE.CanvasTexture, srgb = true) {
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Converts a grayscale height canvas into a tangent-space normal map via a
 * cheap Sobel-style gradient pass. Run once per surface at material-build
 * time (never per frame), so a modest per-pixel cost here is fine — it is
 * what turns flat color into something that actually catches light like
 * woven cloth, tooled leather, or a stack of paper edges. */
function heightToNormalMap(heightCanvas: HTMLCanvasElement, strength = 1.8): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = src[i * 4] / 255;

  const get = (x: number, y: number) => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
    return gray[cy * w + cx];
  };

  const { c: outCanvas, ctx: outCtx } = canvas2d(w, h);
  const outImg = outCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = get(x - 1, y);
      const r = get(x + 1, y);
      const u = get(x, y - 1);
      const d = get(x, y + 1);
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      const idx = (y * w + x) * 4;
      outImg.data[idx] = (nx * 0.5 + 0.5) * 255;
      outImg.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      outImg.data[idx + 2] = (1 / len) * 255;
      outImg.data[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex; // linear data — never mark as sRGB
}

/** Paints fine woven-cloth or pebbled-leather micro-grain onto BOTH a color
 * canvas and (optionally) a parallel grayscale height canvas so the bump
 * reads in lockstep with the color variation instead of looking pasted on. */
function paintGrain(
  ctx: CanvasRenderingContext2D,
  heightCtx: CanvasRenderingContext2D | null,
  w: number,
  h: number,
  variant: "cloth" | "leather"
) {
  ctx.save();
  if (variant === "cloth") {
    // Woven cross-hatch: two overlapping diagonal fiber directions.
    ctx.globalAlpha = 0.075;
    // @ts-ignore
    ctx.filter = "blur(0.5px)";
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((i === 0 ? 1 : -1) * 0.78);
      ctx.translate(-w, -h);
      ctx.strokeStyle = i === 0 ? "#ffffff" : "#000000";
      ctx.lineWidth = 1;
      for (let x = 0; x < w * 2.4; x += 3) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h * 2.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  } else {
    // Leather: irregular pore blotches + fine creases, no repeating grid.
    ctx.globalAlpha = 0.09;
    // @ts-ignore
    ctx.filter = "blur(0.8px)";
    for (let i = 0; i < 340; i++) {
      ctx.fillStyle = rand() > 0.55 ? "#000000" : "#ffffff";
      const s = 1.6 + rand() * 3.4;
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, s, s * (0.6 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.05;
    // @ts-ignore
    ctx.filter = "blur(1.2px)";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x0 = rand() * w, y0 = rand() * h;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + rand() * 60 - 30, y0 + rand() * 60 - 30, x0 + rand() * 90 - 45, y0 + rand() * 40 - 20, x0 + rand() * 120 - 60, y0 + rand() * 120 - 60);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (heightCtx) {
    // Mirror a lower-frequency version of the same grain into the height
    // pass so the weave/pores actually catch light instead of only tinting color.
    heightCtx.save();
    heightCtx.globalAlpha = variant === "cloth" ? 0.5 : 0.4;
    // @ts-ignore
    heightCtx.filter = "blur(0.4px)";
    const hw = heightCtx.canvas.width, hh = heightCtx.canvas.height;
    const n = variant === "cloth" ? 900 : 260;
    for (let i = 0; i < n; i++) {
      heightCtx.fillStyle = rand() > 0.5 ? "#ffffff" : "#000000";
      const s = variant === "cloth" ? 1 + rand() * 1.4 : 2 + rand() * 4;
      heightCtx.fillRect(rand() * hw, rand() * hh, s, s);
    }
    heightCtx.restore();
    heightCtx.globalAlpha = 1;
  }
}

/** Soft worn/rubbed patches at corners and edges — the small imperfections
 * that keep a "premium" material from reading as a sterile flat render. */
function paintWear(ctx: CanvasRenderingContext2D, w: number, h: number, hex: number) {
  ctx.save();
  const corners: [number, number][] = [
    [0, 0], [w, 0], [0, h], [w, h],
    [w / 2, 0], [w / 2, h],
  ];
  for (const [cx, cy] of corners) {
    if (rand() < 0.4) continue; // not every corner is worn — keeps it subtle/random
    const r = 26 + rand() * 30;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const lighten = rand() > 0.3;
    g.addColorStop(0, lighten ? shade(hex, 0.22) : shade(hex, -0.2));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.35 + rand() * 0.25;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A couple of faint age-foxing spots, very low opacity.
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 4; i++) {
    const r = 8 + rand() * 14;
    const x = rand() * w, y = rand() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(70,50,20,0.8)");
    g.addColorStop(1, "rgba(70,50,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Front/back cover: cloth or leather base, gilt double-frame, corner
 * flourishes, emblem, faux title typography — plus a matching low-res
 * height pass so every one of those elements is embossed, not painted on. */
function drawCover(hex: number, variant: "front" | "back", material: "cloth" | "leather") {
  const W = 512, H = 768;
  const { c, ctx } = canvas2d(W, H);
  const HW = 256, HH = 384;
  const { c: hc, ctx: hctx } = canvas2d(HW, HH);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, HW, HH);
  const s = HW / W; // scale factor from color-space coords to height-space coords

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, shade(hex, 0.16));
  grad.addColorStop(0.45, shade(hex, 0.0));
  grad.addColorStop(0.75, shade(hex, -0.12));
  grad.addColorStop(1, shade(hex, -0.26));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  paintGrain(ctx, hctx, W, H, material);
  paintWear(ctx, W, H, hex);

  // Soft vignette for depth (keeps edges from feeling flat/harsh)
  const vig = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.15, W / 2, H * 0.5, H * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Beveled edge — a thin darker band right at the border reads as a
  // physical board edge instead of a texture that just stops.
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.restore();
  hctx.save();
  hctx.strokeStyle = "#3a3a3a";
  hctx.lineWidth = 5 * s;
  hctx.strokeRect(1, 1, HW - 2, HH - 2);
  hctx.restore();

  // Gilt double-frame border with soft glow
  ctx.save();
  ctx.shadowColor = "rgba(255, 225, 170, 0.5)";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "rgba(255, 238, 196, 0.82)";
  ctx.lineWidth = 5;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(255, 238, 196, 0.5)";
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.restore();
  hctx.save();
  hctx.strokeStyle = "#d8d8d8";
  hctx.lineWidth = 5 * s;
  hctx.strokeRect(28 * s, 28 * s, HW - 56 * s, HH - 56 * s);
  hctx.strokeStyle = "#3f3f3f";
  hctx.lineWidth = 2 * s;
  hctx.strokeRect((28 + 6) * s, (28 + 6) * s, HW - (56 + 12) * s, HH - (56 + 12) * s);
  hctx.restore();

  // Corner flourishes
  const corners: [number, number, number, number][] = [
    [40, 40, 1, 1],
    [W - 40, 40, -1, 1],
    [40, H - 40, 1, -1],
    [W - 40, H - 40, -1, -1],
  ];
  ctx.strokeStyle = "rgba(255, 238, 196, 0.75)";
  ctx.lineWidth = 2;
  hctx.strokeStyle = "#d0d0d0";
  hctx.lineWidth = 2 * s;
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + 26 * sy);
    ctx.quadraticCurveTo(x, y, x + 26 * sx, y);
    ctx.stroke();
    hctx.beginPath();
    hctx.moveTo(x * s, (y + 26 * sy) * s);
    hctx.quadraticCurveTo(x * s, y * s, (x + 26 * sx) * s, y * s);
    hctx.stroke();
  }

  if (variant === "front") {
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255, 242, 210, 0.92)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(32, 0);
    ctx.lineTo(0, 36);
    ctx.lineTo(-32, 0);
    ctx.closePath();
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();

    hctx.save();
    hctx.translate(HW / 2, HH * 0.3);
    hctx.strokeStyle = "#e2e2e2";
    hctx.lineWidth = 3 * s;
    hctx.beginPath();
    hctx.arc(0, 0, 66 * s, 0, Math.PI * 2);
    hctx.stroke();
    hctx.beginPath();
    hctx.moveTo(0, -36 * s);
    hctx.lineTo(32 * s, 0);
    hctx.lineTo(0, 36 * s);
    hctx.lineTo(-32 * s, 0);
    hctx.closePath();
    hctx.stroke();
    hctx.restore();

    // Faux title block with soft shadow for legibility/depth
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(255, 242, 214, 0.92)";
    ctx.fillRect(W * 0.24, H * 0.55, W * 0.52, 7);
    ctx.globalAlpha = 0.65;
    ctx.fillRect(W * 0.32, H * 0.585, W * 0.36, 5);
    ctx.globalAlpha = 1;
    ctx.restore();
    hctx.save();
    hctx.fillStyle = "#e6e6e6";
    hctx.fillRect(HW * 0.24, HH * 0.55, HW * 0.52, 5 * s);
    hctx.fillRect(HW * 0.32, HH * 0.585, HW * 0.36, 4 * s);
    hctx.restore();

    ctx.font = "600 34px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "rgba(255, 246, 226, 0.95)";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.fillText("VOL.", W / 2, H * 0.66);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255, 238, 196, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.36, H * 0.86);
    ctx.lineTo(W * 0.64, H * 0.86);
    ctx.stroke();
  }

  const colorTex = finish(new THREE.CanvasTexture(c));
  const normalTex = heightToNormalMap(hc, 1.6);

  // Roughness: cloth reads matte and even; leather is a touch glossier and
  // patchier; the gilt frame is noticeably shinier than the field around it.
  const { c: rc, ctx: rctx } = canvas2d(128, 192);
  const baseRough = material === "cloth" ? 0.82 : 0.5;
  rctx.fillStyle = `rgb(${baseRough * 255},${baseRough * 255},${baseRough * 255})`;
  rctx.fillRect(0, 0, 128, 192);
  rctx.save();
  // @ts-ignore
  rctx.filter = "blur(1px)";
  for (let i = 0; i < 200; i++) {
    const v = Math.max(0, Math.min(255, baseRough * 255 + (rand() - 0.5) * 60));
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(rand() * 128, rand() * 192, 2 + rand() * 3, 2 + rand() * 3);
  }
  rctx.restore();
  const rs = 128 / W;
  rctx.strokeStyle = "rgb(60,60,60)";
  rctx.lineWidth = 3 * rs;
  rctx.strokeRect(28 * rs, 28 * rs, 128 - 56 * rs, 192 - 56 * rs);
  const roughnessTex = new THREE.CanvasTexture(rc);
  roughnessTex.needsUpdate = true;

  // Gilt/emissive mask reused for both a faint metallic glint and a warm
  // emissive glow on the frame + emblem, so the trim actually looks gilded
  // under the point lights rather than just being a bright stroke color.
  const { c: gc, ctx: gctx } = canvas2d(256, 384);
  gctx.fillStyle = "#000000";
  gctx.fillRect(0, 0, 256, 384);
  gctx.strokeStyle = "#ffe1a0";
  gctx.lineWidth = 4;
  gctx.strokeRect(14, 14, 256 - 28, 384 - 28);
  if (variant === "front") {
    gctx.beginPath();
    gctx.arc(128, 384 * 0.3, 33, 0, Math.PI * 2);
    gctx.lineWidth = 2;
    gctx.stroke();
    gctx.fillStyle = "#ffe1a0";
    gctx.fillRect(256 * 0.24, 384 * 0.55, 256 * 0.52, 3.5);
  }
  const giltTex = new THREE.CanvasTexture(gc);
  giltTex.needsUpdate = true;

  return { colorTex, normalTex, roughnessTex, giltTex };
}

/** Narrow spine strip: smooth gradient binding, raised hub ridges (paired
 * highlight+shadow so they read as bumps even before the normal map kicks
 * in), gilt bands, and embossed title lettering. */
function drawSpine(hex: number, material: "cloth" | "leather") {
  const W = 96, H = 768;
  const { c, ctx } = canvas2d(W, H);
  const HW = 48, HH = 384;
  const { c: hc, ctx: hctx } = canvas2d(HW, HH);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, HW, HH);
  const s = HW / W;

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, shade(hex, -0.3));
  grad.addColorStop(0.5, shade(hex, 0.08));
  grad.addColorStop(1, shade(hex, -0.3));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  hctx.save();
  const hgrad = hctx.createLinearGradient(0, 0, HW, 0);
  hgrad.addColorStop(0, "#606060");
  hgrad.addColorStop(0.5, "#909090");
  hgrad.addColorStop(1, "#606060");
  hctx.fillStyle = hgrad;
  hctx.fillRect(0, 0, HW, HH);
  hctx.restore();

  paintGrain(ctx, hctx, W, H, material);

  // Raised binding hubs — a light band immediately followed by a soft dark
  // one gives a convincing "ridge catching the key light" read.
  ctx.save();
  for (let y = 80; y < H; y += 92) {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y - 2);
    ctx.lineTo(W, y - 2);
    ctx.stroke();
    // @ts-ignore
    ctx.filter = "blur(2px)";
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    ctx.lineTo(W, y + 3);
    ctx.stroke();
    // @ts-ignore
    ctx.filter = "none";
  }
  ctx.restore();
  hctx.save();
  for (let y = 80 * s; y < HH; y += 92 * s) {
    hctx.strokeStyle = "#c8c8c8";
    hctx.lineWidth = 3 * s;
    hctx.beginPath();
    hctx.moveTo(0, y - 2 * s);
    hctx.lineTo(HW, y - 2 * s);
    hctx.stroke();
    hctx.strokeStyle = "#454545";
    hctx.lineWidth = 3 * s;
    hctx.beginPath();
    hctx.moveTo(0, y + 3 * s);
    hctx.lineTo(HW, y + 3 * s);
    hctx.stroke();
  }
  hctx.restore();

  // Gilt bands top/bottom with a gentle glow
  ctx.save();
  ctx.shadowColor = "rgba(255, 225, 170, 0.6)";
  ctx.shadowBlur = 5;
  ctx.fillStyle = "rgba(255, 238, 196, 0.85)";
  ctx.fillRect(0, 52, W, 5);
  ctx.fillRect(0, H - 57, W, 5);
  ctx.restore();
  hctx.fillStyle = "#dddddd";
  hctx.fillRect(0, 52 * s, HW, 4 * s);
  hctx.fillRect(0, (H - 57) * s, HW, 4 * s);

  // Faint embossed title band mid-spine (bars only — legible titling isn't
  // the point, the raised/lettered feel is).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "rgba(255, 244, 220, 0.85)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(W * 0.28, H * 0.42 + i * 14, W * 0.44, 4);
  }
  ctx.restore();
  hctx.fillStyle = "#d6d6d6";
  for (let i = 0; i < 3; i++) {
    hctx.fillRect(HW * 0.28, HH * 0.42 + i * 7 * s, HW * 0.44, 3 * s);
  }

  const colorTex = finish(new THREE.CanvasTexture(c));
  const normalTex = heightToNormalMap(hc, 1.8);

  const { c: gc, ctx: gctx } = canvas2d(48, 384);
  gctx.fillStyle = "#000000";
  gctx.fillRect(0, 0, 48, 384);
  gctx.fillStyle = "#ffe1a0";
  gctx.fillRect(0, 26, 48, 2.5);
  gctx.fillRect(0, 384 - 28.5, 48, 2.5);
  const giltTex = new THREE.CanvasTexture(gc);
  giltTex.needsUpdate = true;

  return { colorTex, normalTex, giltTex };
}

/** Page-stack edge: fine, gently varied cream/grey lines mimicking stacked
 * sheets, softened with a light blur, plus a matching ribbed height pass so
 * the individual sheets catch grazing light like a real fore-edge. Some
 * copies get a warm gilt tint on the page edge — a nice premium touch. */
function drawPages(landscape: boolean, gilded: boolean) {
  const w = landscape ? 512 : 160;
  const h = landscape ? 160 : 512;
  const { c, ctx } = canvas2d(w, h);
  const hw = landscape ? 256 : 96;
  const hh = landscape ? 96 : 256;
  const { c: hc, ctx: hctx } = canvas2d(hw, hh);
  ctx.fillStyle = gilded ? "#e9cf8f" : "#f6efdd";
  ctx.fillRect(0, 0, w, h);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, hw, hh);

  ctx.save();
  // @ts-ignore
  ctx.filter = "blur(0.4px)";
  const lines = (landscape ? w : h) / 1.4;
  for (let i = 0; i < lines; i++) {
    const pos = i * 1.4 + rand() * 0.6;
    const tone = 198 + Math.round(rand() * 28);
    const g = gilded ? [tone - 30, tone - 55, tone - 110] : [tone - 18, tone - 30, tone - 58];
    ctx.strokeStyle = `rgba(${g[0]}, ${g[1]}, ${g[2]}, ${0.28 + rand() * 0.22})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (landscape) {
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, h);
    } else {
      ctx.moveTo(0, pos);
      ctx.lineTo(w, pos);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Matching height ribbing so each sheet reads as a tiny physical ridge.
  hctx.save();
  const hlines = (landscape ? hw : hh) / 1.2;
  for (let i = 0; i < hlines; i++) {
    const pos = i * 1.2 + rand() * 0.5;
    const v = 118 + Math.round(rand() * 70);
    hctx.strokeStyle = `rgb(${v},${v},${v})`;
    hctx.lineWidth = 1;
    hctx.beginPath();
    if (landscape) {
      hctx.moveTo(pos, 0);
      hctx.lineTo(pos, hh);
    } else {
      hctx.moveTo(0, pos);
      hctx.lineTo(hw, pos);
    }
    hctx.stroke();
  }
  hctx.restore();

  // Vignette so the page block reads as recessed between covers
  const vg = ctx.createLinearGradient(0, 0, landscape ? 0 : w, landscape ? h : 0);
  vg.addColorStop(0, "rgba(90,65,40,0.26)");
  vg.addColorStop(0.15, "rgba(90,65,40,0)");
  vg.addColorStop(0.85, "rgba(90,65,40,0)");
  vg.addColorStop(1, "rgba(90,65,40,0.26)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  return { colorTex: finish(new THREE.CanvasTexture(c)), normalTex: heightToNormalMap(hc, 1.4) };
}

const pagesCache: Record<string, { colorTex: THREE.Texture; normalTex: THREE.Texture }> = {};

/** Builds the 6-face material array for one book color. Cover/spine textures
 * are unique per color; the page-edge textures are shared since paper looks
 * the same on every book. Roughly a third of books get a leather treatment
 * (glossier, patchier, subtle clearcoat) and the rest cloth (matte, woven),
 * so the shelf reads as a mix of bindings rather than one repeated material. */
export function createBookMaterials(hex: number): THREE.Material[] {
  const material: "cloth" | "leather" = rand() > 0.62 ? "leather" : "cloth";
  const gilded = rand() > 0.5;
  const pagesKey = gilded ? "gilt" : "plain";
  if (!pagesCache[`side-${pagesKey}`]) pagesCache[`side-${pagesKey}`] = drawPages(false, gilded);
  if (!pagesCache[`edge-${pagesKey}`]) pagesCache[`edge-${pagesKey}`] = drawPages(true, gilded);
  const side = pagesCache[`side-${pagesKey}`];
  const edge = pagesCache[`edge-${pagesKey}`];

  const front = drawCover(hex, "front", material);
  const back = drawCover(hex, "back", material);
  const spine = drawSpine(hex, material);

  const commonProps =
    material === "leather"
      ? { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 }
      : { roughness: 0.85, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(shade(hex, 0.3)) };

  // Leather's glossy clearcoat gets its own bump from the same normal map so
  // the shine sits IN the pores and creases rather than floating over them
  // as a flat sheet of glass — this one map reuse is what keeps a "premium"
  // leather cover from reading as laminated plastic under the key light.
  const coverMat = (tex: ReturnType<typeof drawCover>) =>
    new THREE.MeshPhysicalMaterial({
      map: tex.colorTex,
      normalMap: tex.normalTex,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: tex.roughnessTex,
      metalnessMap: tex.giltTex,
      metalness: 0.6,
      emissiveMap: tex.giltTex,
      emissive: new THREE.Color(0xffcf8a),
      emissiveIntensity: 0.16,
      envMapIntensity: 0.95,
      ...commonProps,
      ...(material === "leather" ? { clearcoatNormalMap: tex.normalTex, clearcoatNormalScale: new THREE.Vector2(0.6, 0.6) } : {}),
    });

  const spineMat = new THREE.MeshPhysicalMaterial({
    map: spine.colorTex,
    normalMap: spine.normalTex,
    normalScale: new THREE.Vector2(1.1, 1.1),
    metalnessMap: spine.giltTex,
    metalness: 0.6,
    emissiveMap: spine.giltTex,
    emissive: new THREE.Color(0xffcf8a),
    emissiveIntensity: 0.18,
    envMapIntensity: 0.95,
    ...commonProps,
    ...(material === "leather" ? { clearcoatNormalMap: spine.normalTex, clearcoatNormalScale: new THREE.Vector2(0.7, 0.7) } : {}),
  });

  const pagesEdgeMat = new THREE.MeshStandardMaterial({
    map: side.colorTex,
    normalMap: side.normalTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.92,
    metalness: gilded ? 0.35 : 0,
  });
  const pagesTopMat = new THREE.MeshStandardMaterial({
    map: edge.colorTex,
    normalMap: edge.normalTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.92,
    metalness: gilded ? 0.35 : 0,
  });

  // Order must match BoxGeometry material groups: [+x, -x, +y, -y, +z, -z]
  return [
    pagesEdgeMat, // +x fore-edge (pages)
    spineMat, // -x spine
    pagesTopMat, // +y top pages
    pagesTopMat, // -y bottom pages
    coverMat(front), // +z front cover
    coverMat(back), // -z back cover
  ];
}
