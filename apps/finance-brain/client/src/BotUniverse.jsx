import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Radio } from "lucide-react";

function fibonacciDome(n, radius) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const z = 0.85 - t * 1.55;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = i * golden;
    points.push(
      new THREE.Vector3(Math.cos(phi) * r * radius, Math.sin(phi) * r * radius, z * radius),
    );
  }
  return points;
}

export default function BotUniverse({ botOrder, botMeta, bots, activeBot, mode, onSelect, onRun }) {
  const hostRef = useRef(null);
  const overlayRefs = useRef({});
  const liveRef = useRef({ activeBot, mode });
  liveRef.current = { activeBot, mode };

  useEffect(() => {
    const mount = hostRef.current;
    if (!mount) return;
    let raf,
      hovering = false;
    const scene = new THREE.Scene();
    const width = Math.max(80, mount.clientWidth),
      height = Math.max(80, mount.clientHeight);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.1, 5.6);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const tint = new THREE.Color("#21a4ff");
    const brain = new THREE.Group();
    root.add(brain);
    const pts = [];
    for (const side of [-1, 1])
      for (let i = 0; i < 520; i++) {
        const y = (Math.random() - 0.5) * 1.5,
          z = (Math.random() - 0.5) * 0.86,
          edge = Math.max(0.18, Math.sqrt(Math.max(0.01, 1 - Math.pow(y / 0.86, 2)))),
          x = side * (0.14 + Math.random() * 0.86 * edge);
        if (Math.random() < 0.06) continue;
        pts.push(x, y, z);
      }
    const brainGeo = new THREE.BufferGeometry();
    brainGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    brain.add(
      new THREE.Points(
        brainGeo,
        new THREE.PointsMaterial({
          color: tint,
          size: 0.032,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    for (const rot of [
      [Math.PI / 2, 0, 0],
      [0.25, 0.55, 0.1],
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.01, 8, 100),
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.rotation.set(...rot);
      brain.add(ring);
    }

    const radius = 2.05;
    const anchorPositions = fibonacciDome(botOrder.length, radius);
    const anchors = botOrder.map((id, i) => {
      const anchor = new THREE.Object3D();
      anchor.position.copy(anchorPositions[i]);
      root.add(anchor);
      const color = new THREE.Color(botMeta[id].accent);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        }),
      );
      anchor.add(dot);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        anchor.position.clone(),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.12,
        gapSize: 0.09,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      root.add(line);
      return { id, anchor, dot, lineMat };
    });

    const onEnter = () => (hovering = true);
    const onLeave = () => (hovering = false);
    mount.addEventListener("pointerenter", onEnter);
    mount.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const w = Math.max(80, mount.clientWidth),
        h = Math.max(80, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const vec = new THREE.Vector3();
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      root.rotation.y += hovering ? 0.0006 : 0.0026;
      brain.rotation.y = t * 0.04;
      root.updateMatrixWorld(true);
      const { activeBot: hot } = liveRef.current;
      const w = mount.clientWidth,
        h = mount.clientHeight;
      for (const a of anchors) {
        const isHot = hot === a.id;
        a.lineMat.dashOffset = -t * (isHot ? 1.4 : 0.45);
        a.lineMat.opacity = isHot ? 0.95 : 0.48;
        a.dot.scale.setScalar(isHot ? 1.6 + Math.sin(t * 6) * 0.2 : 1);
        vec.copy(a.anchor.position).applyMatrix4(root.matrixWorld);
        const screen = vec.clone().project(camera);
        const behind = screen.z > 1;
        const x = (screen.x * 0.5 + 0.5) * w;
        const y = (-screen.y * 0.5 + 0.5) * h;
        const el = overlayRefs.current[a.id];
        if (el) {
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${behind ? 0.7 : 1})`;
          el.style.opacity = behind ? 0.28 : 1;
          el.style.zIndex = behind ? 1 : 5;
          el.style.pointerEvents = behind ? "none" : "auto";
        }
      }
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mount.removeEventListener("pointerenter", onEnter);
      mount.removeEventListener("pointerleave", onLeave);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    };
  }, [botOrder, botMeta]);

  return (
    <div className="botUniverse" ref={hostRef}>
      <div className={`uniState ${mode.toLowerCase()}`}>
        <strong>{mode}</strong>
      </div>
      {botOrder.map((id) => {
        const meta = botMeta[id];
        const bot = bots.find((b) => b.id === id);
        const Icon = meta.Icon;
        return (
          <div
            key={id}
            ref={(el) => (overlayRefs.current[id] = el)}
            className={`uniBot ${activeBot === id ? "hot" : ""} ${bot?.active ? "" : "paused"}`}
            style={{ "--accent": meta.accent }}
          >
            <button className="uniBotIcon" onClick={() => onSelect(bot)} title={meta.label}>
              <Icon size={15} />
            </button>
            <button
              className="uniBotRun"
              onClick={(e) => {
                e.stopPropagation();
                onRun(id);
              }}
              title="Ejecutar ahora"
            >
              <Radio size={8} />
            </button>
            <span className="uniBotLabel">
              {meta.n}. {meta.label.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
