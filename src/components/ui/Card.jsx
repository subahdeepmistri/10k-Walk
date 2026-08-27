// Reusable Card component — modern variants for premium redesign (glass for overlays, elevated for data, consistent with new design system)

export default function Card({ children, className = '', variant = 'elevated', glow = false, onClick, id }) {
  let base;
  if (variant === 'glass') {
    base = 'glass rounded-[var(--radius-lg)] p-5';
  } else if (variant === 'flat') {
    base = 'bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5';
  } else {
    base = 'card-elevated rounded-[var(--radius-lg)] p-5';
  }

  const glowClass = glow ? 'ring-1 ring-[var(--color-primary)]/20' : '';
  const interactClass = onClick
    ? 'cursor-pointer active:scale-[0.985] transition-all duration-150 hover:border-[var(--color-primary)]/15 focus-ring'
    : '';

  return (
    <div
      className={`${base} ${glowClass} ${interactClass} ${className}`}
      onClick={onClick}
      id={id}
    >
      {children}
    </div>
  );
}
