// Hairline-bordered card (no shadow) per DESIGN.md elevation level 1.
export function Card({ className = '', children }) {
  return (
    <div className={`rounded-lg border border-hairline bg-canvas p-lg ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className = '' }) {
  return <div className={`type-eyebrow text-ink/70 ${className}`}>{children}</div>;
}

// Oversized pastel color-block section — the signature DESIGN.md surface.
const BLOCK_BG = {
  lime: 'bg-block-lime text-ink',
  lilac: 'bg-block-lilac text-ink',
  cream: 'bg-block-cream text-ink',
  pink: 'bg-block-pink text-ink',
  mint: 'bg-block-mint text-ink',
  coral: 'bg-block-coral text-ink',
  navy: 'bg-block-navy text-inverse-ink',
};

export function ColorBlock({ color = 'lime', className = '', children }) {
  return (
    <div className={`rounded-lg p-lg ${BLOCK_BG[color]} ${className}`}>{children}</div>
  );
}
