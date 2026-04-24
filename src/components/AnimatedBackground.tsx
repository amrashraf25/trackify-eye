import { useEffect, useRef } from "react";

const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string; pulse: number; pulseSpeed: number;
    }[] = [];
    const particleCount = 80;

    const colors = [
      "217 91% 60%",  // neon blue
      "263 70% 58%",  // neon purple
      "187 92% 69%",  // neon cyan
    ];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      });
    }

    const animate = () => {
      time += 0.005;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Animated grid with slow drift
      const gridSize = 60;
      const gridOffset = (time * 8) % gridSize;
      ctx.lineWidth = 0.5;

      for (let x = -gridSize + gridOffset; x < w + gridSize; x += gridSize) {
        const wave = Math.sin(time + x * 0.003) * 3;
        ctx.beginPath();
        ctx.moveTo(x + wave, 0);
        ctx.lineTo(x - wave, h);
        ctx.strokeStyle = `hsl(217 91% 60% / 0.025)`;
        ctx.stroke();
      }
      for (let y = -gridSize + gridOffset; y < h + gridSize; y += gridSize) {
        const wave = Math.cos(time + y * 0.003) * 3;
        ctx.beginPath();
        ctx.moveTo(0, y + wave);
        ctx.lineTo(w, y - wave);
        ctx.strokeStyle = `hsl(263 70% 58% / 0.02)`;
        ctx.stroke();
      }

      // Ambient orbs (large soft glows)
      const orbs = [
        { x: w * 0.2, y: h * 0.3, r: 250, color: "217 91% 60%", phase: 0 },
        { x: w * 0.8, y: h * 0.6, r: 200, color: "263 70% 58%", phase: 2 },
        { x: w * 0.5, y: h * 0.8, r: 180, color: "187 92% 69%", phase: 4 },
      ];

      orbs.forEach((orb) => {
        const ox = orb.x + Math.sin(time + orb.phase) * 40;
        const oy = orb.y + Math.cos(time * 0.7 + orb.phase) * 30;
        const opacity = 0.04 + Math.sin(time * 0.5 + orb.phase) * 0.02;
        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
        gradient.addColorStop(0, `hsl(${orb.color} / ${opacity})`);
        gradient.addColorStop(1, `hsl(${orb.color} / 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(ox - orb.r, oy - orb.r, orb.r * 2, orb.r * 2);
      });

      // Particles
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const pulseFactor = 0.5 + Math.sin(p.pulse) * 0.5;
        const currentOpacity = p.opacity * (0.6 + pulseFactor * 0.4);

        // Glow around particle
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, `hsl(${p.color} / ${currentOpacity * 0.3})`);
        glow.addColorStop(1, `hsl(${p.color} / 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);

        // Core particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.8 + pulseFactor * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.color} / ${currentOpacity})`;
        ctx.fill();

        // Connect nearby particles with gradient lines
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineOpacity = 0.08 * (1 - dist / 140);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsl(${p.color} / ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      });

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
      style={{ opacity: 0.7 }}
    />
  );
};

export default AnimatedBackground;
