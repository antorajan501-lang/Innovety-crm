import React from 'react';

export const ProgressRing = ({ progress = 0, size = 60, strokeWidth = 8, trackWidth = 7 }) => {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const effectiveStroke = strokeWidth || 8;
  const effectiveTrack = trackWidth || 7;
  const radius = (size - effectiveStroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 overflow-visible">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(15, 23, 42, 0.18)"
          strokeWidth={effectiveTrack}
          className="fill-none dark:stroke-white/15"
        />
        {/* Progress bar arc with clean green stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#059669"
          strokeWidth={effectiveStroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="fill-none transition-[stroke-dashoffset] duration-400 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-black text-foreground select-none">
        {Math.round(normalizedProgress)}%
      </span>
    </div>
  );
};


