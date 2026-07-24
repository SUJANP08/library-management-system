import React from "react";
import * as THREE from "three";
import { useThreeScene } from "./useThreeScene";
import { createGlobeColorTexture, createGlobeBumpTexture } from "./globeTextures";

export default function HeroOrbScene({ className = "" }: { className?: string }) {
  const containerRef = useThreeScene({
    fov: 42,
    onInit: ({ scene, camera }) => {
      camera.position.set(0, 0, 7);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const key = new THREE.PointLight(0xf7a768, 3, 30);
      key.position.set(4, 3, 5);
      scene.add(key);
      const rim = new THREE.PointLight(0xf3c858, 2, 30);
      rim.position.set(-4, -2, 3);
      scene.add(rim);

      const colorMap = createGlobeColorTexture();
      const bumpMap = createGlobeBumpTexture();

      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.65, 3),
        new THREE.MeshPhysicalMaterial({
          map: colorMap,
          bumpMap,
          bumpScale: 0.018,
          roughness: 0.28,
          metalness: 0.28,
          clearcoat: 0.7,
          clearcoatRoughness: 0.16,
          emissive: 0x7a3515,
          emissiveIntensity: 0.14,
        })
      );
      scene.add(core);

      // Lat/long wireframe shell — reads as an actual globe grid around the core.
      const wire = new THREE.Mesh(
        new THREE.SphereGeometry(2.0, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0xf3c858, wireframe: true, transparent: true, opacity: 0.28 })
      );
      scene.add(wire);

      // Orbiting satellites — nod to books circling a shelf.
      const satelliteGroup = new THREE.Group();
      scene.add(satelliteGroup);
      const satellites: { mesh: THREE.Mesh; radius: number; angle: number; speed: number; tilt: number }[] = [];
      const colors = [0xf7a768, 0xfff3ea, 0xd89420];
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.BoxGeometry(0.32, 0.44, 0.09);
        const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.4, metalness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        const radius = THREE.MathUtils.randFloat(2.6, 3.3);
        const angle = (i / 5) * Math.PI * 2;
        satelliteGroup.add(mesh);
        satellites.push({ mesh, radius, angle, speed: THREE.MathUtils.randFloat(0.12, 0.22), tilt: THREE.MathUtils.randFloat(-0.5, 0.5) });
      }

      return ({ time, delta, pointer }) => {
        core.rotation.y += 0.12 * delta;
        core.rotation.x += 0.05 * delta;
        wire.rotation.y -= 0.06 * delta;
        wire.rotation.x += 0.03 * delta;

        for (const s of satellites) {
          s.angle += s.speed * delta;
          s.mesh.position.set(Math.cos(s.angle) * s.radius, Math.sin(s.angle * 0.7) * s.tilt * 1.4, Math.sin(s.angle) * s.radius);
          s.mesh.rotation.y = s.angle + Math.PI / 2;
          s.mesh.rotation.x = 0.3;
        }

        camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.03;
        camera.position.y += (-pointer.y * 0.6 - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);
      };
    },
  });

  return <div ref={containerRef} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
