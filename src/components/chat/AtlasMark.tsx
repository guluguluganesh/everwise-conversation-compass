export function AtlasMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" className="fill-primary" />
      <path d="M9 23 L16 8 L23 23 M12 18 H20" className="stroke-primary-foreground" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
