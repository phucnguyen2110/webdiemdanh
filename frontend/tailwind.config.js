/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#7f0df2',
                'primary-hover': '#680ac4',
                'primary-dark': '#5e0ab5',
                'background-light': '#f7f5f8',
                'background-dark': '#191022',
                'surface-dark': '#261834',
                'surface-glass': 'rgba(38, 24, 52, 0.6)',
                'border-glass': 'rgba(255, 255, 255, 0.1)',
            },
            fontFamily: {
                display: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '0.5rem',
                lg: '1rem',
                xl: '1.5rem',
                '2xl': '2rem',
                full: '9999px',
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [
        require('@tailwindcss/container-queries'),
    ],
}
