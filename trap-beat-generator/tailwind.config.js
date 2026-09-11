/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06070b',
          900: '#0a0c12',
          850: '#0f121b',
          800: '#141826',
          750: '#1a1f30',
          700: '#222941',
          600: '#2d3652',
          500: '#3c4869',
          400: '#5b6889',
          300: '#8c98b6',
        },
        acid: {
          400: '#7df0c2',
          500: '#39dfa0',
          600: '#16b981',
        },
        flame: {
          400: '#ff9d6b',
          500: '#ff6b35',
          600: '#e04f1c',
        },
        violethz: {
          400: '#b18cff',
          500: '#8b5cf6',
          600: '#6d3ee0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 30px -18px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseglow: {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s ease-out both',
        pulseglow: 'pulseglow 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
