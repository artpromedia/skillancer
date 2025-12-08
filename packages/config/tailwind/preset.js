/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#1B365D',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#E8EDF3',
          100: '#D1DBE7',
          200: '#A3B7CF',
          300: '#7593B7',
          400: '#476F9F',
          500: '#1B365D',
          600: '#162B4A',
          700: '#112038',
          800: '#0B1525',
          900: '#060B13',
          950: '#030509',
        },
        secondary: {
          DEFAULT: '#2E5A88',
          foreground: 'hsl(var(--secondary-foreground))',
          50: '#EBF1F6',
          100: '#D7E3ED',
          200: '#AFC7DB',
          300: '#87ABC9',
          400: '#5F8FB7',
          500: '#2E5A88',
          600: '#25486D',
          700: '#1C3652',
          800: '#132436',
          900: '#09121B',
          950: '#05090E',
        },
        accent: {
          DEFAULT: '#4A7BA7',
          foreground: 'hsl(var(--accent-foreground))',
          50: '#EEF4F8',
          100: '#DDE9F1',
          200: '#BBD3E3',
          300: '#99BDD5',
          400: '#77A7C7',
          500: '#4A7BA7',
          600: '#3B6286',
          700: '#2C4A64',
          800: '#1E3143',
          900: '#0F1921',
          950: '#080C11',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        skillancer: '0.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        skillancer: '0 4px 6px -1px rgba(27, 54, 93, 0.1), 0 2px 4px -1px rgba(27, 54, 93, 0.06)',
        'skillancer-lg': '0 10px 15px -3px rgba(27, 54, 93, 0.1), 0 4px 6px -2px rgba(27, 54, 93, 0.05)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-from-top': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [],
};
