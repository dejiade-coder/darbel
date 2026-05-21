/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Institutional palette — restrained, governmental-feeling
        ink: {
          DEFAULT: '#0e1116',
          50: '#f6f7f8',
          100: '#e8eaec',
          200: '#cdd2d6',
          300: '#a8b0b6',
          400: '#7a838c',
          500: '#525a62',
          600: '#3a4148',
          700: '#262c32',
          800: '#171b20',
          900: '#0e1116',
        },
        parchment: {
          DEFAULT: '#faf8f4',
          50: '#fdfcf9',
          100: '#faf8f4',
          200: '#f3eee6',
          300: '#e8e0d2',
        },
        // Darbel accent — a deep, considered teal. Quiet authority.
        accent: {
          DEFAULT: '#0f5257',
          50: '#e6f0f0',
          100: '#c2dadc',
          400: '#1c7f86',
          500: '#0f5257',
          600: '#0a3d41',
          700: '#072b2e',
        },
        // Functional state colors
        success: '#1f6b3e',
        warning: '#a35f0e',
        danger: '#9b2c2c',
        info: '#2c5282',
        // Semantic tokens
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      fontFamily: {
        // Distinctive choices — not Inter, not Roboto.
        // 'Newsreader' for editorial display, 'IBM Plex Sans' for body
        // (institutional, slightly governmental feel), 'IBM Plex Mono' for IDs/codes.
        display: ['Newsreader', 'Georgia', 'serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 320ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
