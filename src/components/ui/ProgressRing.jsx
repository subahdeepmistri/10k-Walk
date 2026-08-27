// SVG Progress Ring — modernized for premium redesign (hybrid inner/outer content for readable values + goals on mobile, better glow/scaling)
import { motion } from 'framer-motion';

export default function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  color = 'var(--color-primary)',
  bgColor,
  children,
  className = '',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const offset = circumference - clampedProgress * circumference;

  const bgStroke = bgColor || 'rgba(99, 102, 241, 0.08)';

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ filter: clampedProgress > 0 ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.2))' : 'none' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
