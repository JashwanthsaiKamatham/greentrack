/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: '#F8FAFC',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.10)',
        glass: '0 10px 40px -12px rgb(15 23 42 / 0.14)',
        glow: '0 10px 30px -10px rgb(16 185 129 / 0.55)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pop: { '0%': { opacity: 0, transform: 'translateY(16px) scale(0.98)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
        float: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-18px,0)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        pop: 'pop 0.22s ease-out both',
        float: 'float 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
