/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F4F1EA',
        surface: '#FFFDF8',
        'dark-surface': '#24231F',
        graphite: '#1E1D1A',
        'burnt-orange': {
          DEFAULT: '#D95D39',
          light: '#F8ECE8',
          subtle: '#FAF3F0',
          hover: '#C24E2C',
          dark: '#9E3A1D',
        },
        'moss-green': {
          DEFAULT: '#3F725B',
          light: '#EBF3EF',
          subtle: '#F2F7F4',
          hover: '#345E4B',
          dark: '#284739',
        },
        'muted-amber': {
          DEFAULT: '#C08A3E',
          light: '#FAF3E8',
          subtle: '#FDF9F2',
          hover: '#A97730',
          dark: '#8C5F1C',
        },
        'brick-red': {
          DEFAULT: '#A6423A',
          light: '#F9ECEB',
          subtle: '#FCF4F3',
          hover: '#8C352E',
          dark: '#732A24',
        },
        'warm-gray': {
          DEFAULT: '#77736B',
          50: '#FAF9F6',
          100: '#F4F1EA',
          200: '#EAE6DD',
          300: '#DDD8CE',
          400: '#B5AFA4',
          500: '#77736B',
          600: '#5C5851',
          700: '#43403B',
          800: '#2A2926',
          900: '#1E1D1A',
        },
        border: {
          DEFAULT: '#DDD8CE',
          light: '#EBE7DE',
          dark: '#C7C1B5',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"Outfit"', '"Inter"', 'sans-serif'],
      },
      boxShadow: {
        'fintech-subtle': '0 1px 2px 0 rgba(30, 29, 26, 0.04)',
        'fintech-card': '0 1px 3px 0 rgba(30, 29, 26, 0.06), 0 1px 2px -1px rgba(30, 29, 26, 0.04)',
        'fintech-elevated': '0 4px 6px -1px rgba(30, 29, 26, 0.07), 0 2px 4px -2px rgba(30, 29, 26, 0.05)',
        'fintech-modal': '0 10px 15px -3px rgba(30, 29, 26, 0.1), 0 4px 6px -4px rgba(30, 29, 26, 0.06)',
      },
      borderRadius: {
        'sm': '3px',
        'md': '5px',
        'lg': '7px',
        'xl': '10px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
        'fast': '150ms',
        'normal': '200ms',
      },
    },
  },
  plugins: [],
}
