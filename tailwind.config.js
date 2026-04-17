/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          green: '#2E7D32',
          light: '#4CAF50',
          dark: '#1B5E20',
          bg: '#F5F5F5' // Light grey background
        }
      }
    },
  },
  plugins: [],
}
