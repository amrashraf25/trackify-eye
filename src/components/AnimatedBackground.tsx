import { useEffect, useRef } from "react";

// 3D ambient backdrop tuned for the Trackify Eye identity:
//   • Perspective floor grid that recedes into the horizon (camera viewport feel)
//   • Pseudo-3D star field with z-depth parallax (sized + dimmed by depth)
//   • Slow scanning beam — the AI "looking"
//   • Centered iris pulse — the eye
//   • A few drifting neon orbs for ambient color
const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const STAR_COUNT = 110;
    type Star = { x: number; y: number; z: number; baseSize: number; color: string };
    const stars: Star[] = [];

    const COLORS = [
      "217 91% 60%",  // primary blue
      "263 70% 58%",  // accent purple
      "187 92% 69%",  // cyan
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2,    // -1 .. 1 (normalized)
        y: (Math.random() - 0.5) * 2,
        z: Math.random() * 0.95 + 0.05,  // 0 (far) .. 1 (near)
        baseSize: 0.6 + Math.random() * 1.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    const animate = () => {
      time += 0.006;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const cx = w * 0.5;
      const cy = h * 0.5;

      ctx.clearRect(0, 0, w, h);

      // ── 1. Vignette base wash ──────────────────────────────────────
      const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      wash.addColorStop(0, "hsl(217 91% 60% / 0.04)");
      wash.addColorStop(1, "hsl(263 70% 58% / 0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // ── 2. Perspective floor grid ──────────────────────────────────
      // Lines that converge to a horizon at 55% height — gives the page
      // a 3D depth anchor reminiscent of an AI viewport.
      const horizonY = h * 0.55;
      const drift = (time * 24) % 80;
      ctx.lineWidth = 1;

      // Vertical lines fanning out from the vanishing point
      for (let i = -10; i <= 10; i++) {
        const xBottom = cx + (i / 10) * w * 1.2;
        const grad = ctx.createLinearGradient(cx, horizonY, xBottom, h);
        grad.addColorStop(0, "hsl(217 91% 60% / 0)");
        grad.addColorStop(1, "hsl(217 91% 60% / 0.10)");
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(xBottom, h);
        ctx.stroke();
      }

      // Horizontal scan rows that recede toward horizon, animated drift
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) + drift / 1000;
        const yPos = horizonY + Math.pow(t, 1.6) * (h - horizonY);
        if (yPos > h) continue;
        const alpha = 0.04 + (yPos - horizonY) / (h - horizonY) * 0.10;
        ctx.strokeStyle = `hsl(263 70% 58% / ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(w, yPos);
        ctx.stroke();
      }

      // ── 3. 3D star field (depth parallax) ──────────────────────────
      stars.forEach((s) => {
        // Slow rotation around camera Z axis for depth movement
        s.z -= 0.0007;
        if (s.z <= 0.02) {
          s.z = 1;
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
        }
        // Project onto screen — closer (lower z) = farther from center
        const px = cx + (s.x / s.z) * w * 0.4;
        const py = cy + (s.y / s.z) * h * 0.4;
        if (px < -50 || px > w + 50 || py < -50 || py > h + 50) return;

        const size  = s.baseSize * (1 / s.z) * 0.55;
        const alpha = (1 - s.z) * 0.55;

        const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
        glow.addColorStop(0, `hsl(${s.color} / ${alpha * 0.5})`);
        glow.addColorStop(1, `hsl(${s.color} / 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(px - size * 4, py - size * 4, size * 8, size * 8);

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${s.color} / ${alpha})`;
        ctx.fill();
      });

      // ── 4. Drifting ambient orbs ───────────────────────────────────
      const orbs = [
        { x: w * 0.18, y: h * 0.28, r: 280, color: "217 91% 60%", phase: 0 },
        { x: w * 0.82, y: h * 0.62, r: 240, color: "263 70% 58%", phase: 2.1 },
        { x: w * 0.55, y: h * 0.85, r: 200, color: "187 92% 69%", phase: 4.2 },
      ];
      orbs.forEach((orb) => {
        const ox = orb.x + Math.sin(time + orb.phase) * 50;
        const oy = orb.y + Math.cos(time * 0.7 + orb.phase) * 35;
        const o  = 0.05 + Math.sin(time * 0.5 + orb.phase) * 0.025;
        const g  = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
        g.addColorStop(0, `hsl(${orb.color} / ${o})`);
        g.addColorStop(1, `hsl(${orb.color} / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(ox - orb.r, oy - orb.r, orb.r * 2, orb.r * 2);
      });

      // ── 5. Iris pulse — the "eye" of Trackify Eye ──────────────────
      // Concentric rings expanding outward from the centre, faint but cool.
      for (let r = 0; r < 4; r++) {
        const phase = (time * 0.4 + r * 0.4) % 1;
        const radius = phase * Math.min(w, h) * 0.45;
        const alpha = (1 - phase) * 0.10;
        ctx.beginPath();
        ctx.arc(cx, cy * 0.45, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(187 92% 69% / ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── 6. Slow scanning beam (AI is watching) ─────────────────────
      const beamY = ((time * 0.12) % 1) * h;
      const beamGrad = ctx.createLinearGradient(0, beamY - 80, 0, beamY + 80);
      beamGrad.addColorStop(0,    "hsl(217 91% 60% / 0)");
      beamGrad.addColorStop(0.5,  "hsl(217 91% 60% / 0.05)");
      beamGrad.addColorStop(1,    "hsl(217 91% 60% / 0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, beamY - 80, w, 160);

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.85 }}
    />
  );
};

export default AnimatedBackground;
