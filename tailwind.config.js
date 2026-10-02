/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./web/**/*.{js,ts,jsx,tsx}",
    "./shared/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vaicar: {
          green: '#16A34A',        // Primary Brand
          dark: '#15803D',         // Hover/Dark
          bright: '#22C55E',       // Active/Online
          light: '#DCFCE7',        // Subtle background
          soft: '#F0FDF4',         // Very light background
          deep: '#14532D',         // High contrast text
          yellow: '#FACC15',       // Warning/Attention
          yellowDark: '#CA8A04',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}