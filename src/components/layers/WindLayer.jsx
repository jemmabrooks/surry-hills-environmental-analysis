import { useEffect, useRef } from 'react';
import { SYDNEY } from '../../constants';

// Animated wind particles drawn on a full-viewport canvas overlay.
// Treats wind as a uniform suburb-scale field (indicative, not geo-projected).
// wind: { direction (deg, FROM), speed (km/h) }.
export function WindLayer({ wind }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (particlesRef.current.length === 0) seed(canvas, particlesRef.current);
    };
    resize();
    window.addEventListener('resize', resize);

    const speed = wind?.speed ?? 10;
    // Wind direction "from" → screen vector "to". True bearing with declination.
    const trueFrom = ((wind?.direction ?? 0) + SYDNEY.magneticDeclination) % 360;
    const toBearing = (trueFrom + 180) % 360;
    const rad = (toBearing * Math.PI) / 180;
    // Screen: x east(+sin), y south(+, so north is -cos).
    const vx = Math.sin(rad);
    const vy = -Math.cos(rad);
    const pxPerFrame = 0.4 + Math.min(2.5, speed / 12);
    const color = speedColor(speed);

    seed(canvas, particlesRef.current);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      for (const p of particlesRef.current) {
        const nx = p.x + vx * pxPerFrame * p.s;
        const ny = p.y + vy * pxPerFrame * p.s;
        ctx.globalAlpha = p.a;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx;
        p.y = ny;
        p.life -= 1;
        if (
          p.life <= 0 ||
          p.x < -20 || p.x > canvas.width + 20 ||
          p.y < -20 || p.y > canvas.height + 20
        ) {
          respawn(canvas, p);
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [wind?.direction, wind?.speed]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 5 }}
    />
  );
}

function seed(canvas, arr) {
  arr.length = 0;
  const n = 220;
  for (let i = 0; i < n; i++) {
    arr.push(newParticle(canvas));
  }
}

function newParticle(canvas) {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: 0.6 + Math.random() * 0.8,
    a: 0.15 + Math.random() * 0.4,
    life: 40 + Math.random() * 120,
  };
}

function respawn(canvas, p) {
  Object.assign(p, newParticle(canvas));
}

function speedColor(kmh) {
  // calm → strong ramp
  if (kmh < 8) return '#7fb3d5';
  if (kmh < 16) return '#48a9a6';
  if (kmh < 25) return '#e4b343';
  return '#e4572e';
}
