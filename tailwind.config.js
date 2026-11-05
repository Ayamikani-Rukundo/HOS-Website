/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#d6a949',
          amber: '#efb84a',
          green: '#123b31',
          emerald: '#2d6a5d',
          mist: '#eaf3ef',
          charcoal: '#0f1720',
        },
      },
      boxShadow: {
        glow: '0 20px 45px rgba(214, 169, 73, 0.25)',
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at top, rgba(214,169,73,0.25), transparent 40%), linear-gradient(135deg, rgba(15,23,32,0.95), rgba(18,59,49,0.9))',
      },
    },
  },
  plugins: [],
};
