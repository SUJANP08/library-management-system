import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface ThreeSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export type ThreeFrameFn = (args: {
  time: number;
  delta: number;
  pointer: { x: number; y: number };
  pointerDown: boolean;
  size: { width: number; height: number };
}) => void;

/** onInit may return just the per-frame callback, or a callback plus a
 * disposer for any extra listeners/resources it registered (e.g. its own
 * pointerdown handler for a "select/click" interaction). A scene that needs
 * post-processing (e.g. a bloom pass) can supply `render` to take over the
 * actual draw call for that frame instead of the default `renderer.render`,
 * and `resize` to keep any composer/render-target sized to match. */
export type ThreeInitResult =
  | ThreeFrameFn
  | {
      frame?: ThreeFrameFn;
      dispose?: () => void;
      render?: () => void;
      resize?: (width: number, height: number) => void;
    }
  | void;

interface Options {
  /** Called once after the renderer/scene/camera are created. Build your objects here. */
  onInit: (setup: ThreeSetup) => ThreeInitResult;
  /** Camera field of view */
  fov?: number;
  /** Clear color alpha (0 = transparent canvas) */
  alpha?: boolean;
  /** Pixel ratio cap to keep GPU cost sane on hi-dpi screens */
  maxPixelRatio?: number;
  /** Tone mapping mode for the renderer — filmic rolloff reads far more
   * premium on PBR materials (gilt highlights, clearcoat) than the flat
   * linear default, but it's opt-in since it changes how every color reads. */
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
}

/**
 * Mounts a self-contained three.js scene into the returned ref's element.
 * Handles resize, pointer parallax, visibility pausing, reduced-motion, and disposal.
 */
export function useThreeScene({
  onInit,
  fov = 45,
  alpha = true,
  maxPixelRatio = 1.75,
  toneMapping = THREE.NoToneMapping,
  toneMappingExposure = 1,
}: Options) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = toneMapping;
    renderer.toneMappingExposure = toneMappingExposure;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let pointerDown = false;

    function handlePointerMove(e: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      targetPointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      targetPointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    // Tracked globally (not on the canvas itself, which stays pointer-events-none
    // for purely decorative scenes) so a scene can add a light "select" reaction
    // to real clicks elsewhere on the page without ever intercepting them.
    function handlePointerDown() {
      pointerDown = true;
    }
    function handlePointerUp() {
      pointerDown = false;
    }
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    let onResize: ((width: number, height: number) => void) | undefined;

    function resize() {
      const width = container!.clientWidth || 1;
      const height = container!.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      onResize?.(width, height);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const initResult = onInit({ scene, camera, renderer });
    const onFrame: ThreeFrameFn | undefined =
      typeof initResult === "function" ? initResult : initResult?.frame;
    const onDispose = typeof initResult === "object" ? initResult?.dispose : undefined;
    const onRender = typeof initResult === "object" ? initResult?.render : undefined;
    onResize = typeof initResult === "object" ? initResult?.resize : undefined;
    // A scene registering a resize hook after the initial `resize()` call
    // above needs one immediate sync so its composer/render-target starts
    // life at the right size instead of the 1x1 default.
    if (onResize) resize();

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    function handleVisibility() {
      running = document.visibilityState === "visible";
      if (running) loop();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    function loop() {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      // Ease pointer for smooth parallax rather than snapping to raw mouse deltas.
      pointer.x += (targetPointer.x - pointer.x) * 0.04;
      pointer.y += (targetPointer.y - pointer.y) * 0.04;

      onFrame?.({
        time,
        delta: prefersReducedMotion ? 0 : delta,
        pointer,
        pointerDown,
        size: { width: container!.clientWidth, height: container!.clientHeight },
      });
      if (onRender) onRender();
      else renderer.render(scene, camera);
    }
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.removeEventListener("visibilitychange", handleVisibility);
      onDispose?.();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return containerRef;
}
