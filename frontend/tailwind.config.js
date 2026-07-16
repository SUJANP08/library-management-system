/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Noto Sans Kannada renders Kannada glyphs; system fonts cover the rest.
        sans: ['"Noto Sans Kannada"', '"Noto Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d9e7f5',
          200: '#b3cfec',
          300: '#8db7e2',
          400: '#5f97d3',
          500: '#3877c2',
          600: '#2a5da0',
          700: '#1e3a5f',
          800: '#182f4d',
          900: '#12233a',
        },
      },
    },
  },
  plugins: [],
}
