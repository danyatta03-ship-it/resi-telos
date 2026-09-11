import { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/engine';

interface VisualizerProps {
  active: boolean;
  className?: string;
}

/** Oscilloscopio del bus master. */
export function Visualizer({ active, className = '' }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const analyser = audioEngine.analyser;
      const values = analyser ? (analyser.getValue() as Float32Array) : null;

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = active ? '#39dfa0' : '#2d3652';
      ctx.beginPath();
      if (values && values.length) {
        for (let i = 0; i < values.length; i++) {
          const x = (i / (values.length - 1)) * width;
          const y = height / 2 - values[i] * height * 0.46;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} aria-hidden />;
}
