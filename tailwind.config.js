/** @type {import('tailwindcss').Config} */
// Design tokens mapped from DESIGN.md (Figma marketing system).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#000000',
        'on-primary': '#ffffff',
        ink: '#000000',
        canvas: '#ffffff',
        'inverse-canvas': '#000000',
        'inverse-ink': '#ffffff',
        hairline: '#e6e6e6',
        'hairline-soft': '#f1f1f1',
        'surface-soft': '#f7f7f5',
        'block-lime': '#dceeb1',
        'block-lilac': '#c5b0f4',
        'block-cream': '#f4ecd6',
        'block-pink': '#efd4d4',
        'block-mint': '#c8e6cd',
        'block-coral': '#f3c9b6',
        'block-navy': '#1f1d3d',
        'accent-magenta': '#ff3d8b',
        success: '#1ea64a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '2px',
        sm: '6px',
        md: '8px',
        lg: '24px',
        xl: '32px',
        pill: '50px',
        full: '9999px',
      },
      spacing: {
        hair: '1px',
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '96px',
      },
      boxShadow: {
        soft: '0 4px 16px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
