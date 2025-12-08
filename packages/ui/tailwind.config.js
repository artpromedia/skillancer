const preset = require('@skillancer/config/tailwind/preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {},
  },
  plugins: [require('tailwindcss-animate')],
};
