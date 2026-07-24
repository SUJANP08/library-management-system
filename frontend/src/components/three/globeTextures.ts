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

let seed = 7;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function finish(tex: THREE.CanvasTexture) {
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Smooth, softly marbled gilt surface with fine anti-aliased meridian/parallel
 * lines and a few soft glowing sparkles — reads as a polished ornamental globe. */
export function createGlobeColorTexture(): THREE.Texture {
  const S = 1024;
  const { c, ctx } = canvas2d(S, S);

  const grad = ctx.createRadialGradient(S * 0.36, S * 0.32, S * 0.05, S * 0.5, S * 0.5, S * 0.74);
  grad.addColorStop(0, "#ffe6ad");
  grad.addColorStop(0.32, "#f8b667");
  grad.addColorStop(0.62, "#ea7c33");
  grad.addColorStop(1, "#a8481a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Marbled veining, rendered on an offscreen pass and blurred so it blends
  // smoothly instead of reading as sharp scratches.
  const veinCanvas = document.createElement("canvas");
  veinCanvas.width = S;
  veinCanvas.height = S;
  const vctx = veinCanvas.getContext("2d")!;
  for (let i = 0; i < 22; i++) {
    vctx.strokeStyle = rand() > 0.5 ? "rgba(255, 244, 220, 0.16)" : "rgba(120, 52, 20, 0.16)";
    vctx.lineWidth = 14 + rand() * 34;
    vctx.beginPath();
    const x0 = rand() * S, y0 = rand() * S;
    vctx.moveTo(x0, y0);
    vctx.bezierCurveTo(
      rand() * S, rand() * S,
      rand() * S, rand() * S,
      x0 + (rand() - 0.5) * 560, y0 + (rand() - 0.5) * 560
    );
    vctx.stroke();
  }
  ctx.save();
  // @ts-ignore - 2D canvas filter, gracefully ignored where unsupported
  ctx.filter = "blur(10px)";
  ctx.drawImage(veinCanvas, 0, 0);
  ctx.restore();

  // Gilt meridians (great-circle ellipses) — thin, soft, evenly spaced
  ctx.save();
  ctx.strokeStyle = "rgba(255, 242, 210, 0.4)";
  ctx.lineWidth = 1.3;
  for (let m = 0; m < 7; m++) {
    const rx = 60 + m * (S * 0.5 - 60) / 6;
    ctx.beginPath();
    ctx.ellipse(S / 2, S / 2, rx, S / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Parallels (latitude bands)
  for (let p = 1; p < 6; p++) {
    const ry = ((S / 2) / 6) * p;
    ctx.beginPath();
    ctx.ellipse(S / 2, S / 2, S / 2, ry * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Soft glowing sparkle points (radial gradient per point, not a hard dot)
  for (let i = 0; i < 34; i++) {
    const x = rand() * S, y = rand() * S, r = 3 + rand() * 5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255, 252, 235, 0.85)");
    g.addColorStop(1, "rgba(255, 252, 235, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gentle edge vignette for a rounded, polished feel
  const vig = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.5);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(60, 24, 8, 0.28)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return finish(tex);
}

/** Very subtle grayscale relief, softened with a blur pass so the facets pick
 * up gentle highlights rather than a harsh speckled bump. */
export function createGlobeBumpTexture(): THREE.Texture {
  const S = 512;
  const { c, ctx } = canvas2d(S, S);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, S, S);

  const noise = document.createElement("canvas");
  noise.width = S;
  noise.height = S;
  const nctx = noise.getContext("2d")!;
  for (let i = 0; i < 420; i++) {
    const v = Math.round(rand() * 70 + 70);
    nctx.fillStyle = `rgb(${v},${v},${v})`;
    const r = rand() * 8 + 3;
    nctx.beginPath();
    nctx.arc(rand() * S, rand() * S, r, 0, Math.PI * 2);
    nctx.fill();
  }
  ctx.save();
  // @ts-ignore
  ctx.filter = "blur(4px)";
  ctx.drawImage(noise, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return finish(tex);
}
