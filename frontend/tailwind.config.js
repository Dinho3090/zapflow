/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00e5a0',
          50:  '#e6fff6',
          100: '#b3ffe6',
          200: '#00e5a0',
          300: '#00cc8e',
          400: '#00b37d',
        },
        surface: {
          DEFAULT: '#0f1319',
          50:  '#161b24',
          100: '#0f1319',
          200: '#080b10',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
