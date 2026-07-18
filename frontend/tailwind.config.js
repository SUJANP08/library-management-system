/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Noto Sans Kannada renders Kannada glyphs; system fonts cover the rest.
        sans: ['"Noto Sans Kannada"', '"Noto Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Display serif for headlines/hero moments — pairs with the saffron brand
        // accent for a premium, editorial feel distinct from the utility UI face.
        display: ['"Fraunces"', '"Noto Sans Kannada"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Warm cream surface tones, sampled from the KAK logo background.
        cream: {
          50: '#fdfaf6',
          100: '#f7f0e6',
          200: '#efe3cf',
          300: '#e3d0b2',
        },
        // Saffron / marigold - sampled directly from the KAK crest, the library's
        // primary interactive color (sidebar active state, primary buttons, links).
        brand: {
          50: '#fff3ea',
          100: '#fee3cc',
          200: '#fbc79b',
          300: '#f7a768',
          400: '#f38b3c',
          500: '#e8722a',
          600: '#c85a1e',
          700: '#a34618',
          800: '#7a3515',
          900: '#4a2413',
          950: '#2e160b',
        },
        // Warm gold - secondary accent, distinct enough from brand for
        // two-tone badges/highlights while staying in the same family.
        accent: {
          50: '#fef9e9',
          100: '#fcefc4',
          200: '#f8dd8c',
          300: '#f3c858',
          400: '#eab030',
          500: '#d89420',
          600: '#b87615',
          700: '#925a12',
          800: '#6e4310',
          900: '#4c2e0c',
        },
        // Deep ink - used for the premium dark surfaces (sidebar, hero, footer)
        // instead of flat black, keeping warmth consistent with the brand.
        ink: {
          50: '#f4f2f0',
          100: '#e4e0dc',
          200: '#c7bfb8',
          300: '#978a7e',
          400: '#6b5d52',
          500: '#4a3d34',
          600: '#382e27',
          700: '#2b231d',
          800: '#1f1914',
          900: '#16110d',
          950: '#0e0a08',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(74, 36, 19, 0.05), 0 1px 3px 0 rgba(74, 36, 19, 0.07)',
        card: '0 1px 2px 0 rgba(74, 36, 19, 0.04), 0 4px 14px -4px rgba(74, 36, 19, 0.12)',
        cardHover: '0 2px 4px 0 rgba(74, 36, 19, 0.05), 0 12px 24px -8px rgba(74, 36, 19, 0.18)',
        popover: '0 8px 30px -6px rgba(74, 36, 19, 0.28)',
        glow: '0 0 0 1px rgba(232, 114, 42, 0.08), 0 8px 24px -8px rgba(232, 114, 42, 0.35)',
        glass: '0 8px 32px -8px rgba(22, 17, 13, 0.28), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        'mesh-hero': 'radial-gradient(60% 50% at 15% 20%, rgba(243,197,88,0.35) 0%, transparent 60%), radial-gradient(50% 45% at 85% 10%, rgba(232,114,42,0.45) 0%, transparent 60%), radial-gradient(70% 60% at 50% 100%, rgba(163,70,24,0.55) 0%, transparent 65%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'rise': 'rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'float': 'float 7s ease-in-out infinite',
        'float-slow': 'float 11s ease-in-out infinite',
        'shimmer': 'shimmer 2.2s linear infinite',
        'scale-in': 'scaleIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(14px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-14px) translateX(6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
