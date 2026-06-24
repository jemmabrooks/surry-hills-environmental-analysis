// Pill / circular buttons per DESIGN.md. Every CTA is a pill; icons are circles.
export function Button({ variant = 'primary', className = '', children, ...rest }) {
  const base = 'type-link inline-flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-on-primary rounded-pill px-lg py-xs',
    secondary: 'bg-canvas text-ink ring-1 ring-hairline rounded-pill px-lg py-xs',
    tertiary: 'bg-transparent text-ink rounded-full px-sm py-xs',
    magenta: 'bg-accent-magenta text-on-primary rounded-pill px-lg py-xs',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ className = '', inverse = false, children, ...rest }) {
  const tone = inverse
    ? 'bg-white/15 text-inverse-ink'
    : 'bg-surface-soft text-ink';
  return (
    <button
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${tone} transition-transform active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Pill toggle group (e.g. 2D / 3D, analysis tabs).
export function PillToggle({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex gap-xxs rounded-pill bg-surface-soft p-xxs ${className}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`type-link rounded-pill px-md py-xxs text-[16px] transition-colors ${
              selected ? 'bg-primary text-on-primary' : 'bg-transparent text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
