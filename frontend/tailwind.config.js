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
        background: "rgba(var(--background), <alpha-value>)",
        foreground: "rgba(var(--foreground), <alpha-value>)",
        card: "rgba(var(--card), <alpha-value>)",
        "card-foreground": "rgba(var(--card-foreground), <alpha-value>)",
        popover: "rgba(var(--popover), <alpha-value>)",
        primary: {
          DEFAULT: "rgba(var(--primary), <alpha-value>)",
          hover: "rgba(var(--primary-hover), <alpha-value>)",
          foreground: "rgba(var(--primary-foreground), <alpha-value>)",
        },
        secondary: "rgba(var(--secondary), <alpha-value>)",
        muted: {
          DEFAULT: "rgba(var(--muted), <alpha-value>)",
          foreground: "rgba(var(--muted-foreground), <alpha-value>)",
        },
        accent: "rgba(var(--accent), <alpha-value>)",
        success: "rgba(var(--success), <alpha-value>)",
        warning: "rgba(var(--warning), <alpha-value>)",
        danger: "rgba(var(--danger), <alpha-value>)",
        info: "rgba(var(--info), <alpha-value>)",
        indigo: "rgba(var(--indigo), <alpha-value>)",
        violet: "rgba(var(--violet), <alpha-value>)",
        amber: "rgba(var(--amber), <alpha-value>)",
        rose: "rgba(var(--rose), <alpha-value>)",
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
