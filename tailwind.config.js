/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        display: ['"Sora"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f6f9fb',
          100: '#eaf1f4',
          200: '#d4e1e7',
          300: '#aac1cc',
          400: '#7a96a4',
          500: '#557685',
          600: '#3d5b6a',
          700: '#2c4654',
          800: '#1c3140',
          900: '#0f2030',
          950: '#08121c',
        },
        teal: {
          50: '#effaf7',
          100: '#d6f3eb',
          200: '#aee5d6',
          300: '#7fd1bd',
          400: '#4ebaa1',
          500: '#2fa389',
          600: '#0f766e',
          700: '#0d5e58',
          800: '#0c4a45',
          900: '#093c39',
        },
        cobalt: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b7ceff',
          300: '#8aaeff',
          400: '#5a8af8',
          500: '#3a6ce8',
          600: '#2454a6',
          700: '#1d4485',
          800: '#1a386b',
          900: '#172e57',
        },
        amber: {
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
        },
        danger: {
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
        },
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(15, 32, 48, 0.04), 0 1px 1px rgba(15, 32, 48, 0.03)',
        'panel': '0 1px 3px rgba(15, 32, 48, 0.06), 0 4px 12px rgba(15, 32, 48, 0.04)',
        'pop': '0 4px 12px rgba(15, 32, 48, 0.08), 0 12px 32px rgba(15, 32, 48, 0.06)',
        'inset-line': 'inset 0 -1px 0 rgba(15, 32, 48, 0.06)',
      },
      backgroundImage: {
        'grid-soft':
          'linear-gradient(to right, rgba(36, 84, 166, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(36, 84, 166, 0.04) 1px, transparent 1px)',
        'noise':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.13 0 0 0 0 0.19 0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
      backgroundSize: {
        'grid-32': '32px 32px',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
