import React from "react";
import * as THREE from "three";
import { useThreeScene } from "./useThreeScene";

/**
 * A slow-drifting field of small glowing points, used as ambient texture
 * behind dark panels (sidebar, hero banners). Cheap to render — a single
 * Points object, no per-particle JS objects in the hot loop.
 */
export default function ParticleFieldScene({
  className = "",
  count = 140,
  color = "#f3c858",
}: {
  className?: string;
  count?: number;
  color?: string;
}) {
  const containerRef = useThreeScene({
    fov: 60,
    onInit: ({ scene, camera }) => {
      camera.position.set(0, 0, 6);

      const positions = new Float32Array(count * 3);
      const speeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = THREE.MathUtils.randFloatSpread(10);
        positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(14);
        positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(6);
        speeds[i] = THREE.MathUtils.randFloat(0.05, 0.18);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size: 0.045,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      return ({ time, delta, pointer }) => {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          let y = pos.getY(i) + speeds[i] * delta * 6;
          if (y > 7) y = -7;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        points.rotation.y = time * 0.02 + pointer.x * 0.08;
        points.rotation.x = pointer.y * 0.05;
      };
    },
  });

  return (
    <div ref={containerRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />
  );
}
