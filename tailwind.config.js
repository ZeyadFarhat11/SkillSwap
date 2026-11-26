/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.pug'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        'splash-bg': '#EEF2FC',
        'brand-blue': '#0A3B7B',
        'brand-green': '#00A865',
        'tagline-blue': '#1D4ED8',
        'spark-amber': '#EAB308',
        pageBg: '#F4F7FC',
        primaryBlue: '#0057C2',
        mintBg: '#DCF7E9',
        mintText: '#0E7A4A',
        softBlueBg: '#E1EDFF',
        softBlueText: '#185BCE',
        brand: {
          blue: '#0058b8',
          'blue-hover': '#004aa0',
          accent: '#0d6efd',
          navy: '#0b2545',
          green: '#10b981',
          hover: '#014594',
          light: '#EBF3FC',
          inputBg: '#f8fafc',
          inputBorder: '#e2e8f0',
        },
        badge: {
          greenBg: '#d7fbe8',
          greenText: '#106437',
          blueBg: '#e6efff',
          blueText: '#1a5ec8',
          ratingBg: '#f0f6ff',
        },
        neutral: {
          bg: '#F5F7FA',
          border: '#E8ECF2',
          card: '#FFFFFF',
          dark: '#141A29',
          muted: '#717D96',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
