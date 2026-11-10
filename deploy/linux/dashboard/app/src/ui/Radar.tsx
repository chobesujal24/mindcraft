import { useEffect, useRef, useState } from "react";
import type { Threat } from "../data/types";
import { IconButton } from "./Button";
import { Icon } from "./icons";

export type RadarRange = 32 | 52;

type RadarProps = {
  threats: Threat[];
  range: RadarRange;
  onRangeChange?: (range: RadarRange) => void;
  bot?: { x: number | null; y: number | null; z: number | null } | null;
  onExpand?: () => void;
  className?: string;
};

function readTheme(): string {
  return document.documentElement.dataset.theme === "hanami" ? "hanami" : "yozakura";
}

export function Radar({ threats, range, onRangeChange, bot, onExpand, className }: RadarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threatsRef = useRef(threats);
  const botRef = useRef(bot);
  const [size, setSize] = useState(320);
  const [paused, setPaused] = useState(false);
  const [theme, setTheme] = useState(readTheme);

  threatsRef.current = threats;
  botRef.current = bot;

  const criticalCount = threats.filter((t) => t && Number.isFinite(t.distance) && t.distance <= 10).length;

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setSize(Math.max(220, Math.round(width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // A 1.5x cap keeps the scope sharp without allocating oversized high-DPI buffers.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const isDay = theme === "hanami";
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || (isDay ? "#d9487f" : "#f0aec0");
    const accentHi = styles.getPropertyValue("--accent-hi").trim() || (isDay ? "#b03060" : "#ffd0dc");
    const text = styles.getPropertyValue("--text").trim() || (isDay ? "#2a161e" : "#f3ede8");
    const dim = styles.getPropertyValue("--dim").trim() || (isDay ? "#5a3d48" : "#aaa2ab");
    const mute = styles.getPropertyValue("--mute").trim() || (isDay ? "#7c6670" : "#837b86");
    const ok = styles.getPropertyValue("--ok").trim() || (isDay ? "#286b49" : "#a9c9b4");
    const warn = styles.getPropertyValue("--warn").trim() || (isDay ? "#9a5b06" : "#e4c690");
    const danger = styles.getPropertyValue("--danger").trim() || (isDay ? "#b42318" : "#e38b95");
    const ringColor = isDay ? "rgba(29, 28, 22, 0.18)" : "rgba(233, 229, 218, 0.15)";
    const gridColor = isDay ? "rgba(29, 28, 22, 0.09)" : "rgba(233, 229, 218, 0.075)";
    const cardBg = isDay ? "rgba(251, 248, 241, 0.94)" : "rgba(17, 19, 15, 0.92)";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsIntersectionObserver = typeof window.IntersectionObserver === "function";
    let inViewport = !supportsIntersectionObserver;
    let frame = 0;
    let running = false;
    let canvasReady = false;
    let lastDraw = 0;
    const frameInterval = 1000 / 30;
    let start = performance.now();
    let phase = -Math.PI / 2;
    const radius = Math.floor(size / 2 - 16);
    const center = Math.round(size / 2);

    const prepareCanvas = () => {
      if (canvasReady) return;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvasReady = true;
    };

    const releaseCanvas = () => {
      if (!canvasReady) return;
      // Drop the backing bitmap when it is offscreen or the tab is hidden.
      canvas.width = 0;
      canvas.height = 0;
      canvasReady = false;
    };

    const draw = (now: number) => {
      prepareCanvas();
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size, size);

      context.save();
      context.translate(center, center);

      // 1. Radar Scope Deep Disk Background
      const scopeGrad = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      if (isDay) {
        scopeGrad.addColorStop(0, "rgba(255, 253, 248, 0.98)");
        scopeGrad.addColorStop(0.75, "rgba(248, 244, 235, 0.88)");
        scopeGrad.addColorStop(1, "rgba(240, 235, 224, 0.94)");
      } else {
        scopeGrad.addColorStop(0, "rgba(23, 25, 20, 0.95)");
        scopeGrad.addColorStop(0.7, "rgba(15, 17, 13, 0.94)");
        scopeGrad.addColorStop(1, "rgba(9, 10, 8, 0.98)");
      }
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fillStyle = scopeGrad;
      context.fill();

      // 2. Concentric Range Rings & Distance Metric Labels
      for (let index = 1; index <= 4; index += 1) {
        const ringR = (radius * index) / 4;
        context.beginPath();
        context.arc(0, 0, ringR, 0, Math.PI * 2);
        context.strokeStyle = index === 4 ? ringColor : gridColor;
        context.lineWidth = index === 4 ? 1.4 : 0.8;
        context.stroke();

        // Distance tags along 45° axis (North-East quadrant)
        const distVal = Math.round((range * index) / 4);
        const tagAngle = -Math.PI / 4;
        const tagX = Math.cos(tagAngle) * ringR;
        const tagY = Math.sin(tagAngle) * ringR;

        context.font = "500 7px 'JetBrains Mono', monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";

        // Pill backing
        const tagText = `${distVal}m`;
        const textW = context.measureText(tagText).width;
        context.fillStyle = isDay ? "rgba(255, 255, 255, 0.75)" : "rgba(10, 8, 12, 0.75)";
        context.fillRect(tagX - textW / 2 - 2, tagY - 4.5, textW + 4, 9);

        context.fillStyle = mute;
        context.fillText(tagText, tagX, tagY);
      }

      // 3. Compass Azimuth Perimeter Ticks & Degree Labels
      const tickCount = 72; // every 5 degrees
      for (let i = 0; i < tickCount; i += 1) {
        const tickAngle = (i / tickCount) * Math.PI * 2;
        const isCardinal = i % 18 === 0; // 0, 90, 180, 270 deg
        const isMajor = i % 6 === 0;    // every 30 deg
        const tickLen = isCardinal ? 8 : isMajor ? 5 : 3;

        context.beginPath();
        context.moveTo(Math.cos(tickAngle) * (radius - tickLen), Math.sin(tickAngle) * (radius - tickLen));
        context.lineTo(Math.cos(tickAngle) * radius, Math.sin(tickAngle) * radius);
        context.strokeStyle = isCardinal ? ringColor : gridColor;
        context.lineWidth = isCardinal ? 1.4 : isMajor ? 0.9 : 0.6;
        context.stroke();
      }

      // Compass Degree / Azimuth Numbers
      context.font = "600 7.5px 'JetBrains Mono', monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";

      const azimuths: { angle: number; label: string; cardinal: string }[] = [
        { angle: -Math.PI / 2, label: "000°", cardinal: "N" },
        { angle: 0, label: "090°", cardinal: "E" },
        { angle: Math.PI / 2, label: "180°", cardinal: "S" },
        { angle: Math.PI, label: "270°", cardinal: "W" },
      ];

      azimuths.forEach(({ angle: a, label, cardinal }) => {
        const textDist = radius - 16;
        const lx = Math.cos(a) * textDist;
        const ly = Math.sin(a) * textDist;

        // Cardinal tag
        context.fillStyle = accent;
        context.font = "700 8px 'JetBrains Mono', monospace";
        context.fillText(cardinal, lx, ly - 4.5);

        // Degree tag
        context.fillStyle = mute;
        context.font = "500 6.5px 'JetBrains Mono', monospace";
        context.fillText(label, lx, ly + 4.5);
      });

      // Intermediate azimuth degrees (030°, 060°, 120°, 150°, 210°, 240°, 300°, 330°)
      context.font = "500 6.5px 'JetBrains Mono', monospace";
      context.fillStyle = isDay ? "rgba(124, 102, 112, 0.6)" : "rgba(131, 123, 134, 0.6)";
      [30, 60, 120, 150, 210, 240, 300, 330].forEach((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const lx = Math.cos(rad) * (radius - 12);
        const ly = Math.sin(rad) * (radius - 12);
        context.fillText(String(deg).padStart(3, "0") + "°", lx, ly);
      });

      // 4. Micro-Crosshairs with Center Reticle
      context.save();
      context.beginPath();
      // East-West axis (clearing 8px center)
      context.moveTo(-radius, 0);
      context.lineTo(-8, 0);
      context.moveTo(8, 0);
      context.lineTo(radius, 0);
      // North-South axis (clearing 8px center)
      context.moveTo(0, -radius);
      context.lineTo(0, -8);
      context.moveTo(0, 8);
      context.lineTo(0, radius);
      context.strokeStyle = gridColor;
      context.lineWidth = 0.8;
      context.setLineDash([2, 5]);
      context.stroke();
      context.restore();

      // Origin tactical agent indicator (player ENI-01)
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.strokeStyle = accent;
      context.lineWidth = 1;
      context.stroke();

      const originPulse = 1.6 + Math.sin(now / 350) * 0.4;
      context.beginPath();
      context.arc(0, 0, originPulse, 0, Math.PI * 2);
      context.fillStyle = accentHi;
      context.fill();

      // 5. Phosphorescent Radar Sweep Cone with Logarithmic Fade
      const sweepAngle = reduced || paused ? phase : -Math.PI / 2 + ((now - start) / 5400) * Math.PI * 2;
      if (!reduced && !paused) phase = sweepAngle;

      context.save();
      // Logarithmic Phosphor Cone: 64 wedge slices spanning ~85 degrees
      const coneSpan = Math.PI * 0.46;
      const slices = 64;
      for (let s = 0; s < slices; s += 1) {
        const norm = s / slices;
        const alpha = Math.pow(1 - norm, 2.3) * (isDay ? 0.2 : 0.22);
        const aStart = sweepAngle - ((s + 1) / slices) * coneSpan;
        const aEnd = sweepAngle - (s / slices) * coneSpan;

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, radius, aStart, aEnd, false);
        context.closePath();
        context.fillStyle = accent;
        context.globalAlpha = alpha;
        context.fill();
      }

      // Sweep Beam Leading Edge (Sharp needle + phosphor bloom)
      const needleX = Math.cos(sweepAngle) * radius;
      const needleY = Math.sin(sweepAngle) * radius;

      // Soft glow
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(needleX, needleY);
      context.strokeStyle = accent;
      context.lineWidth = 3;
      context.globalAlpha = 0.35;
      context.stroke();

      // Sharp core needle
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(needleX, needleY);
      context.strokeStyle = accentHi;
      context.lineWidth = 1.3;
      context.globalAlpha = 0.95;
      context.stroke();

      // Luminous needle tip pip
      context.beginPath();
      context.arc(needleX, needleY, 2.5, 0, Math.PI * 2);
      context.fillStyle = accentHi;
      context.globalAlpha = 0.9;
      context.fill();
      context.restore();

      // 6. Threat Blips with Breathing Radar Ripples & Military HUD Cards
      const current = threatsRef.current;
      const botPos = botRef.current;
      const hasOrigin = Boolean(
        botPos && botPos.x !== null && botPos.z !== null && Number.isFinite(botPos.x) && Number.isFinite(botPos.z),
      );
      const scale = (radius - 14) / range;

      current.forEach((threat, index) => {
        if (!threat || !Number.isFinite(threat.distance) || threat.distance > range) return;
        if (!hasOrigin || !Number.isFinite(threat.x) || !Number.isFinite(threat.z)) return;

        let x = (threat.x - Number(botPos!.x)) * scale;
        let y = (threat.z - Number(botPos!.z)) * scale;
        const distanceFromCenter = Math.hypot(x, y);
        if (distanceFromCenter > radius) {
          x = (x / distanceFromCenter) * radius;
          y = (y / distanceFromCenter) * radius;
        }

        const hostile = threat.distance <= 10;
        const caution = threat.distance <= 20;
        const color = hostile ? danger : caution ? warn : ok;

        // Tactical azimuth bearing (000° to 359°)
        const bearing = (Math.round((Math.atan2(x, -y) * 180) / Math.PI) + 360) % 360;
        const bearingStr = String(bearing).padStart(3, "0") + "°";

        // Phosphor flare when sweep beam passes over this blip
        const blipAngle = Math.atan2(y, x);
        const angleDiff = ((sweepAngle - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const isFlarescent = angleDiff < 0.65;
        const flareIntensity = isFlarescent ? (1 - angleDiff / 0.65) : 0;

        context.save();
        context.translate(x, y);

        // Breathing radar ping ripple
        const ripplePhase = (now / 1100 + index * 0.45) % 1;
        const rippleRadius = 4 + ripplePhase * 13;
        const rippleAlpha = (1 - ripplePhase) * (hostile ? 0.65 : 0.35);

        context.beginPath();
        context.arc(0, 0, rippleRadius, 0, Math.PI * 2);
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.globalAlpha = rippleAlpha;
        context.stroke();

        if (flareIntensity > 0) {
          // Extra flare bloom
          context.beginPath();
          context.arc(0, 0, 7 + flareIntensity * 5, 0, Math.PI * 2);
          context.fillStyle = color;
          context.globalAlpha = flareIntensity * 0.3;
          context.fill();
        }

        // Tactical Reticle Icon
        context.globalAlpha = 1;
        if (hostile) {
          // Military chevron / diamond reticle
          context.beginPath();
          context.moveTo(0, -5);
          context.lineTo(5, 0);
          context.lineTo(0, 5);
          context.lineTo(-5, 0);
          context.closePath();
          context.strokeStyle = color;
          context.lineWidth = 1.3;
          context.stroke();

          context.beginPath();
          context.arc(0, 0, 2, 0, Math.PI * 2);
          context.fillStyle = color;
          context.fill();
        } else if (caution) {
          // Diamond pip
          context.beginPath();
          context.moveTo(0, -4);
          context.lineTo(4, 0);
          context.lineTo(0, 4);
          context.lineTo(-4, 0);
          context.closePath();
          context.fillStyle = color;
          context.fill();
        } else {
          // Circular safe blip
          context.beginPath();
          context.arc(0, 0, 3, 0, Math.PI * 2);
          context.fillStyle = color;
          context.fill();
        }

        // Crisp Military Tactical HUD Contact Card
        const isRight = x >= 0;
        const isBottom = y > radius * 0.4;
        const cardW = 96;
        const cardH = 25;
        const cardX = isRight ? 12 : -12 - cardW;
        const cardY = isBottom ? -cardH - 6 : 6;

        // Leader connecting line
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(isRight ? 8 : -8, isBottom ? -6 : 6);
        context.lineTo(cardX + (isRight ? 0 : cardW), cardY + cardH / 2);
        context.strokeStyle = color;
        context.lineWidth = 0.8;
        context.globalAlpha = 0.45;
        context.stroke();

        // Card backing pill
        context.beginPath();
        context.roundRect(cardX, cardY, cardW, cardH, 4);
        context.fillStyle = cardBg;
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 0.9;
        context.globalAlpha = 0.55;
        context.stroke();

        // Contact details
        context.globalAlpha = 1;
        context.textBaseline = "top";
        context.textAlign = "left";

        // Line 1: Threat Tag + Callout
        const badgeTag = hostile ? "CRIT" : caution ? "WARN" : "SAFE";
        context.font = "700 7px 'JetBrains Mono', monospace";
        context.fillStyle = color;
        context.fillText(badgeTag, cardX + 5, cardY + 4);

        const nameStr = threat.username || "UNKNOWN";
        context.font = "600 7.5px 'JetBrains Mono', monospace";
        context.fillStyle = text;
        const truncatedName = nameStr.length > 9 ? nameStr.slice(0, 8) + "…" : nameStr;
        context.fillText(truncatedName, cardX + 28, cardY + 3.5);

        // Line 2: Distance + Azimuth + Delta Y
        const distStr = `${Math.round(threat.distance)}m`;
        let metaStr = `${distStr} · ${bearingStr}`;
        if (botPos?.y !== undefined && threat.y !== undefined && Number.isFinite(threat.y) && Number.isFinite(botPos.y)) {
          const dy = Math.round(threat.y - Number(botPos.y));
          metaStr += ` ${dy >= 0 ? `+${dy}` : dy}`;
        }
        context.font = "500 6.5px 'JetBrains Mono', monospace";
        context.fillStyle = dim;
        context.fillText(metaStr, cardX + 5, cardY + 14);

        context.restore();
      });

      context.restore();

      // Bottom Status Indicator
      context.font = "600 8.5px 'JetBrains Mono', monospace";
      context.fillStyle = mute;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(
        !hasOrigin && current.length ? "ORIGIN UNAVAILABLE" : paused || reduced ? "SWEEP HELD" : "PPI SWEEP ACTIVE",
        center,
        size - 8,
      );
    };

    const loop = (now: number) => {
      if (!running) return;
      if (now - lastDraw >= frameInterval) {
        draw(now);
        lastDraw = now;
      }
      frame = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (running || paused || reduced || document.hidden || !inViewport) return;
      running = true;
      start = performance.now();
      lastDraw = 0;
      frame = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopLoop();
        releaseCanvas();
      } else if (inViewport) {
        draw(performance.now());
        startLoop();
      }
    };

    const visibilityObserver = supportsIntersectionObserver
      ? new IntersectionObserver(([entry]) => {
          const visible = Boolean(entry?.isIntersecting);
          if (visible === inViewport) return;
          inViewport = visible;
          if (visible && !document.hidden) {
            draw(performance.now());
            startLoop();
          } else {
            stopLoop();
            releaseCanvas();
          }
        }, { rootMargin: "96px" })
      : null;
    if (visibilityObserver && wrapRef.current) visibilityObserver.observe(wrapRef.current);
    if (!supportsIntersectionObserver) {
      draw(performance.now());
      startLoop();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopLoop();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      releaseCanvas();
    };
  }, [size, range, paused, theme]);

  return (
    <div className={className ? `radar ${className}` : "radar"} ref={wrapRef}>
      <div className="radar__scope">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Player radar, ${range} metre range, ${threats.length} contacts tracked`}
        />
        <div className="radar__hud" aria-hidden="true">
          <span className="radar__hud-badge">
            <Icon name="compass" size={11} />
            RNG {range}M
          </span>
          <span
            className="radar__hud-badge"
            data-alert={criticalCount > 0 ? "true" : undefined}
          >
            {criticalCount > 0 ? `⚠ ${criticalCount} CRITICAL` : `${threats.length} CONTACT${threats.length === 1 ? "" : "S"}`}
          </span>
        </div>
      </div>
      <div className="radar__deck">
        <div className="radar__legend" aria-hidden="true">
          <span style={{ color: "var(--ok)" }}>
            <i /> Safe &gt; 20m
          </span>
          <span style={{ color: "var(--warn)" }}>
            <i /> Caution 10–20m
          </span>
          <span style={{ color: "var(--danger)" }}>
            <i /> Critical &lt; 10m
          </span>
        </div>
        <div className="radar__controls">
          <div className="seg" role="group" aria-label="Radar range">
            {([32, 52] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => onRangeChange?.(option)}
              >
                {option}m
              </button>
            ))}
          </div>
          <IconButton
            label={paused ? "Resume radar sweep" : "Pause radar sweep"}
            pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            <Icon name={paused ? "play" : "pause"} size={13} />
          </IconButton>
          {onExpand && (
            <IconButton label="Expand radar" onClick={onExpand}>
              <Icon name="arrow-up-right" size={13} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
