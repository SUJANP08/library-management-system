import React from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { useThreeScene } from "./useThreeScene";
import { createBookMaterials } from "./bookTextures";

const PALETTE = [0xf38b3c, 0xe8722a, 0xc85a1e, 0xf3c858, 0xd89420, 0x7a3515];

/** Shared soft-blob sprite texture used for every book's floating contact
 * shadow. Built once and reused so we only ever pay for one canvas. A second,
 * even-softer variant backs the wider "ambient" shadow layer beneath it —
 * two tiers read as a grounded, physical drop shadow instead of one flat blob. */
let shadowSpriteTex: THREE.Texture | null = null;
function getShadowTexture() {
  if (shadowSpriteTex) return shadowSpriteTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.6, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowSpriteTex = new THREE.CanvasTexture(c);
  return shadowSpriteTex;
}

let ambientShadowTex: THREE.Texture | null = null;
function getAmbientShadowTexture() {
  if (ambientShadowTex) return ambientShadowTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.30)");
  g.addColorStop(0.5, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ambientShadowTex = new THREE.CanvasTexture(c);
  return ambientShadowTex;
}

interface BookState {
  mesh: THREE.Mesh;
  shadow: THREE.Sprite;
  shadowSoft: THREE.Sprite;
  w: number;
  h: number;
  speed: number;
  radius: number;
  angle: number;
  yOff: number;
  // Slow constant tumble (gives every book a lazy, alive drift at rest).
  tumble: THREE.Vector3;
  // Extra angular velocity layered on top of `tumble` for inertia/impulses —
  // decays on its own each frame rather than snapping back instantly.
  angVel: THREE.Vector3;
  // Accumulated "resting" orientation (tumble + impulses only). Kept separate
  // from mesh.quaternion so the hover "present toward camera" blend has a
  // stable base to slerp away from and back to, rather than fighting itself.
  restEuler: THREE.Euler;
  // Spring-damped offset from the book's orbital position, used for hover
  // lift and click "kick" reactions so movement overshoots and settles
  // instead of teleporting to its target.
  posOffset: THREE.Vector3;
  posVel: THREE.Vector3;
  hover: number;
  hoverTarget: number;
  scalePop: number;
  breathePhase: number;
  materials: THREE.Material[];
  baseEmissive: number[];
  baseNormalScale: [number, number][];
}

/**
 * Purely decorative — sits behind the login card. Renders a small field of
 * richly textured "book" blocks that drift, tumble slowly, lean toward the
 * cursor for parallax, softly light up and lift on hover, gently turn to
 * present their cover to the viewer, and ripple with a light inertial "kick"
 * whenever the person clicks anywhere on the page. No interactivity is
 * intercepted: the canvas stays pointer-events-none the whole time, all of
 * this reacts to global pointer state only.
 */
export default function FloatingBooksScene({ className = "" }: { className?: string }) {
  const containerRef = useThreeScene({
    fov: 50,
    // Filmic rolloff on the highlights is what makes the gilt trim and
    // clearcoat leather actually read as "premium" rather than just bright —
    // flat/linear tone mapping clips those hot spots to a hard white disc.
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.1,
    onInit: ({ scene, camera, renderer }) => {
      camera.position.set(0, 0, 11);

      // A softly lit interior environment gives the covers and gilt trim
      // something believable to reflect — without it, physical materials
      // (clearcoat, sheen, metalness) just look muddy/grey.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      scene.add(new THREE.HemisphereLight(0xfff3ea, 0x2a1608, 0.55));
      scene.add(new THREE.AmbientLight(0xffffff, 0.28));
      const key = new THREE.PointLight(0xffb37a, 2.6, 40);
      key.position.set(6, 6, 8);
      scene.add(key);
      const rim = new THREE.PointLight(0xf3c858, 1.5, 40);
      rim.position.set(-8, -4, 6);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xfff6e8, 0.4);
      fill.position.set(-3, 5, 10);
      scene.add(fill);

      const group = new THREE.Group();
      scene.add(group);

      const books: BookState[] = [];
      const shadowTex = getShadowTexture();
      const softShadowTex = getAmbientShadowTexture();

      // Build one textured material set per palette color and clone a fresh
      // set of material *instances* per book (cheap — textures stay shared)
      // so each book can independently brighten on hover without affecting
      // every other book of the same color.
      const baseMaterialsByColor = new Map<number, THREE.Material[]>();
      function materialsFor(color: number) {
        let base = baseMaterialsByColor.get(color);
        if (!base) {
          base = createBookMaterials(color);
          baseMaterialsByColor.set(color, base);
        }
        return base.map((m) => m.clone());
      }

      const count = 14;
      for (let i = 0; i < count; i++) {
        const w = THREE.MathUtils.randFloat(0.9, 1.6);
        const h = THREE.MathUtils.randFloat(1.3, 2.1);
        const d = THREE.MathUtils.randFloat(0.22, 0.42);
        const geo = new THREE.BoxGeometry(w, h, d);
        const color = PALETTE[i % PALETTE.length];
        const materials = materialsFor(color);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.castShadow = false;

        const radius = THREE.MathUtils.randFloat(3.2, 9.5);
        const angle = Math.random() * Math.PI * 2;
        const yOff = THREE.MathUtils.randFloat(-4.5, 4.5);
        const initRotX = Math.random() * Math.PI;
        const initRotY = Math.random() * Math.PI;
        const initRotZ = Math.random() * Math.PI;
        mesh.position.set(Math.cos(angle) * radius, yOff, Math.sin(angle) * radius - 4);
        mesh.rotation.set(initRotX, initRotY, initRotZ);
        group.add(mesh);

        const shadow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: shadowTex, transparent: true, opacity: 0.22, depthWrite: false })
        );
        shadow.scale.set(w * 1.6, h * 1.2, 1);
        group.add(shadow);

        // Wider, softer halo beneath the tight contact shadow — the pairing
        // is what sells "resting on/near a surface with real depth" instead
        // of a single flat blob pasted behind the book.
        const shadowSoft = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: softShadowTex, transparent: true, opacity: 0.16, depthWrite: false })
        );
        shadowSoft.scale.set(w * 2.6, h * 2.1, 1);
        group.add(shadowSoft);

        const baseEmissive = materials.map((m) => (m as any).emissiveIntensity ?? 0);
        const baseNormalScale: [number, number][] = materials.map((m) => {
          const ns = (m as any).normalScale as THREE.Vector2 | undefined;
          return ns ? [ns.x, ns.y] : [0, 0];
        });

        books.push({
          mesh,
          shadow,
          shadowSoft,
          w,
          h,
          speed: THREE.MathUtils.randFloat(0.03, 0.09) * (Math.random() > 0.5 ? 1 : -1),
          radius,
          angle,
          yOff,
          tumble: new THREE.Vector3(
            THREE.MathUtils.randFloat(0.05, 0.18),
            THREE.MathUtils.randFloat(0.05, 0.18),
            THREE.MathUtils.randFloat(0.02, 0.1)
          ),
          angVel: new THREE.Vector3(),
          restEuler: new THREE.Euler(initRotX, initRotY, initRotZ),
          posOffset: new THREE.Vector3(),
          posVel: new THREE.Vector3(),
          hover: 0,
          hoverTarget: 0,
          scalePop: 0,
          breathePhase: Math.random() * Math.PI * 2,
          materials,
          baseEmissive,
          baseNormalScale,
        });
      }

      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let wasPointerDown = false;

      // Scratch objects reused every frame (books are updated sequentially,
      // never concurrently, so one shared instance per type is safe and
      // avoids allocating garbage 14 times per frame).
      const restQuat = new THREE.Quaternion();
      const presentQuat = new THREE.Quaternion();
      const presentHelper = new THREE.Object3D();

      // Frame-rate-independent ease: returns how far to move toward a target
      // this frame given a "how much per second" rate, instead of a fixed
      // per-frame fraction that would speed up/slow down with the refresh rate.
      const easeAmt = (rate: number, delta: number) => 1 - Math.pow(1 - rate, delta * 60);
      // Smoothstep reads more natural than a raw linear hover value when
      // driving the rotation blend — eases in and out of the "presented" pose.
      const smoothstep = (t: number) => t * t * (3 - 2 * t);

      return {
        frame: ({ time, delta, pointer, pointerDown }) => {
          // Raycast against the book field using the same eased pointer the
          // camera parallax already uses, so hover highlighting tracks the
          // same smoothed cursor rather than jittering with raw mouse input.
          ndc.set(pointer.x, -pointer.y);
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(
            books.map((b) => b.mesh),
            false
          );
          const hoveredMesh = hits[0]?.object as THREE.Mesh | undefined;

          // Rising edge of a real click anywhere on the page — send a soft
          // inertial "kick" rippling outward from the hovered book (or the
          // camera-forward point if nothing's directly under the cursor).
          if (pointerDown && !wasPointerDown) {
            const origin = new THREE.Vector3();
            if (hoveredMesh) origin.copy(hoveredMesh.position);
            else {
              raycaster.ray.at(9, origin);
            }
            for (const b of books) {
              const dist = b.mesh.position.distanceTo(origin);
              const impulse = Math.max(0, 1 - dist / 6.5);
              if (impulse <= 0.001) continue;
              b.angVel.x += (Math.random() - 0.5) * impulse * 1.8;
              b.angVel.y += (Math.random() - 0.5) * impulse * 1.8;
              b.angVel.z += (Math.random() - 0.5) * impulse * 1.2;
              const dir = new THREE.Vector3().subVectors(b.mesh.position, origin).normalize();
              if (dist < 0.001) dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
              b.posVel.addScaledVector(dir, impulse * 2.2);
              b.scalePop = Math.max(b.scalePop, impulse);
            }
          }
          wasPointerDown = pointerDown;

          for (const b of books) {
            // Slow orbital drift (unchanged in spirit from before).
            b.angle += b.speed * delta;
            const orbitX = Math.cos(b.angle) * b.radius;
            const orbitZ = Math.sin(b.angle) * b.radius - 4;
            const orbitY = b.yOff + Math.sin(time * 0.5 + b.angle) * 0.6;

            // Hover state — eased toward its target so lighting up and
            // lifting feel like a soft transition, not a toggle switch.
            b.hoverTarget = b.mesh === hoveredMesh ? 1 : 0;
            const hoverRate = b.hoverTarget > b.hover ? 0.12 : 0.06;
            b.hover += (b.hoverTarget - b.hover) * easeAmt(hoverRate, delta);

            // Spring-damper on the extra position offset: velocity is pulled
            // back toward zero offset (stiffness) and constantly loses energy
            // (damping), which is what makes an impulse feel like inertia
            // settling rather than a bounce that snaps back.
            const stiffness = 10;
            const damping = 6;
            b.posVel.addScaledVector(b.posOffset, -stiffness * delta);
            b.posVel.multiplyScalar(Math.max(0, 1 - damping * delta));
            b.posOffset.addScaledVector(b.posVel, delta);

            // Hover also nudges the book toward the camera a touch, layered
            // on top of the spring offset so a click-kick mid-hover still reads.
            const towardCamera = new THREE.Vector3()
              .subVectors(camera.position, new THREE.Vector3(orbitX, orbitY, orbitZ))
              .normalize()
              .multiplyScalar(b.hover * 0.55);

            // Depth-layered parallax: books nearer the camera shift more with
            // the pointer than distant ones, on top of the camera's own
            // parallax move — real multi-plane depth instead of everything
            // sliding together as one flat layer.
            const camDist = camera.position.z - orbitZ;
            const depthFactor = THREE.MathUtils.clamp(
              THREE.MathUtils.mapLinear(camDist, 6, 22, 1.3, 0.15),
              0.12,
              1.3
            );
            const parallaxX = pointer.x * depthFactor * 0.32;
            const parallaxY = -pointer.y * depthFactor * 0.32;

            b.mesh.position.set(
              orbitX + b.posOffset.x + towardCamera.x + parallaxX,
              orbitY + b.posOffset.y + towardCamera.y + parallaxY,
              orbitZ + b.posOffset.z + towardCamera.z
            );

            // Angular velocity: constant lazy tumble plus decaying impulses,
            // accumulated into a stable "resting" orientation.
            b.angVel.multiplyScalar(Math.max(0, 1 - 2.4 * delta));
            b.restEuler.x += (b.tumble.x + b.angVel.x) * delta;
            b.restEuler.y += (b.tumble.y + b.angVel.y) * delta;
            b.restEuler.z += (b.tumble.z + b.angVel.z) * delta;
            restQuat.setFromEuler(b.restEuler);

            // On hover, gently turn the book to present its cover to the
            // viewer — blended by an eased hover amount so it reads as a
            // considered, responsive turn rather than a snap to attention,
            // and still lets a click-kick's tumble show through underneath.
            const presentAmt = smoothstep(b.hover) * 0.88;
            if (presentAmt > 0.001) {
              presentHelper.position.copy(b.mesh.position);
              presentHelper.up.set(0, 1, 0);
              presentHelper.lookAt(camera.position);
              presentHelper.rotateY(Math.PI); // face +Z (the front cover) toward camera instead of -Z
              presentQuat.copy(presentHelper.quaternion);
              b.mesh.quaternion.copy(restQuat).slerp(presentQuat, presentAmt);
            } else {
              b.mesh.quaternion.copy(restQuat);
            }

            // Scale: a light hover lift, a decaying "pop" from clicks, and a
            // barely-there idle breathing drift so resting books never look
            // perfectly frozen even before anything reacts to the cursor.
            b.scalePop *= Math.max(0, 1 - 3.5 * delta);
            const breathe = 1 + Math.sin(time * 0.7 + b.breathePhase) * 0.012;
            const targetScale = (1 + b.hover * 0.1 + b.scalePop * 0.14) * breathe;
            const curScale = b.mesh.scale.x + (targetScale - b.mesh.scale.x) * easeAmt(0.15, delta);
            b.mesh.scale.setScalar(curScale);

            // Emissive gilt glow brightens slightly on hover so the trim
            // catches the eye without the whole book flattening into a glow.
            // Normal-map strength also nudges up a touch on hover, so leaning
            // in "reveals" a bit more grain/weave detail — a small tactile
            // reward for paying attention to a particular book.
            for (let i = 0; i < b.materials.length; i++) {
              const mat = b.materials[i] as any;
              if (typeof mat.emissiveIntensity === "number") {
                mat.emissiveIntensity = b.baseEmissive[i] * (1 + b.hover * 1.6);
              }
              if (mat.normalScale) {
                const [nx, ny] = b.baseNormalScale[i];
                mat.normalScale.set(nx * (1 + b.hover * 0.3), ny * (1 + b.hover * 0.3));
              }
            }

            // Contact shadow: sits a touch behind/below the book (away from
            // the key light) and softens/shrinks slightly as the book lifts
            // toward camera on hover, selling the sense of separation/depth.
            b.shadow.position.set(
              b.mesh.position.x - 0.4,
              b.mesh.position.y - 0.5,
              b.mesh.position.z - 0.6 - b.hover * 0.3
            );
            const shadowMat = b.shadow.material as THREE.SpriteMaterial;
            shadowMat.opacity = 0.22 + b.hover * 0.1;
            const shadowScale = 1 + b.hover * 0.18;
            b.shadow.scale.set(b.w * 1.6 * shadowScale, b.h * 1.2 * shadowScale, 1);

            // Wider ambient halo: grows and softens further as the book lifts,
            // instead of tightening like the contact shadow does — the two
            // moving in opposite directions is what makes the lift read as
            // the book actually leaving the surface rather than just scaling up.
            b.shadowSoft.position.set(
              b.mesh.position.x - 0.55,
              b.mesh.position.y - 0.7,
              b.mesh.position.z - 0.9 - b.hover * 0.5
            );
            const shadowSoftMat = b.shadowSoft.material as THREE.SpriteMaterial;
            shadowSoftMat.opacity = 0.16 * (1 - b.hover * 0.4);
            const softScale = 1 + b.hover * 0.3;
            b.shadowSoft.scale.set(b.w * 2.6 * softScale, b.h * 2.1 * softScale, 1);
          }

          // Gentle camera parallax toward the pointer, eased in useThreeScene.
          camera.position.x += (pointer.x * 1.4 - camera.position.x) * 0.02;
          camera.position.y += (-pointer.y * 1.0 - camera.position.y) * 0.02;
          camera.lookAt(0, 0, -2);
          group.rotation.y = time * 0.015;
        },
        dispose: () => {
          envTex.dispose();
          pmrem.dispose();
        },
      };
    },
  });

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    />
  );
}
