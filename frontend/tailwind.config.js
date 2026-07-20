/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: "rgba(var(--border), <alpha-value>)",
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        card: "rgb(var(--card))",
        "card-foreground": "rgb(var(--card-foreground))",
        popover: "rgb(var(--popover))",
        primary: {
          DEFAULT: "rgb(var(--primary))",
          hover: "rgb(var(--primary-hover))",
          foreground: "rgb(var(--primary-foreground))",
        },
        secondary: "rgb(var(--secondary))",
        muted: {
          DEFAULT: "rgb(var(--muted))",
          foreground: "rgb(var(--muted-foreground))",
        },
        accent: "rgb(var(--accent))",
        success: "rgb(var(--success))",
        warning: "rgb(var(--warning))",
        danger: "rgb(var(--danger))",
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        premium: "0 4px 30px rgba(0, 0, 0, 0.03)",
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      backdropFilter: {
        none: 'none',
        blur: 'blur(20px)',
      },
    },
  },
  plugins: [],
}
