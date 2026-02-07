/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

// Gradient utilities plugin
const gradientPlugin = plugin(function({ addUtilities, addComponents }) {
  // 1. Background gradient utilities
  addUtilities({
    '.bg-gradient-primary': {
      backgroundImage: 'radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)',
    },
    '.bg-gradient-secondary': {
      backgroundImage: 'radial-gradient(circle, hsl(var(--secondary)) 0%, transparent 70%)',
    },
    '.bg-gradient-brand': {
      backgroundImage: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--secondary)))',
    },
    '.bg-gradient-radial': {
      backgroundImage: 'radial-gradient(var(--tw-gradient-stops))',
    },
    '.bg-gradient-conic': {
      backgroundImage: 'conic-gradient(var(--tw-gradient-stops))',
    },
    // Hover glow effect utilities
    '.hover-glow': {
      transition: 'box-shadow 0.3s ease-in-out',
      '&:hover': {
        boxShadow: '0 0 40px 10px hsl(var(--accent) / 0.7)',
      },
    },
    '.hover-glow-primary': {
      transition: 'box-shadow 0.3s ease-in-out',
      '&:hover': {
        boxShadow: '0 0 40px 10px hsl(var(--primary) / 0.5)',
      },
    },
  });

  // 2. Gradient border component
  addComponents({
    '.border-gradient-brand': {
      position: 'relative',
      zIndex: '0',
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: '0',
        zIndex: '-1',
        borderRadius: 'inherit',
        padding: '1px',
        background: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--secondary)))',
        '-webkit-mask': 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        'mask': 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        '-webkit-mask-composite': 'xor',
        'mask-composite': 'exclude',
      },
    },
  });
});

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New theme system - primary color variables
        bg: "hsl(var(--bg, 0 0% 98%))",
        surface: "hsl(var(--surface, 220 60% 99%))",
        border: "hsl(var(--border, 220 20% 88%))",
        text: "hsl(var(--text, 220 30% 15%))",
        "text-secondary": "hsl(var(--text-secondary, 220 15% 45%))",
        accent: "hsl(var(--accent, 220 90% 56%))",

        // Base colors (backward compatible with legacy system)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Interactive colors
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        // Semantic colors
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        // Sidebar colors
        sidebar: {
          background: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
        },

        // State colors
        hover: "hsl(var(--hover))",
        success: {
          DEFAULT: "hsl(var(--success))",
          light: "hsl(var(--success-light))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          light: "hsl(var(--warning-light))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          light: "hsl(var(--info-light))",
        },
        indigo: {
          DEFAULT: "hsl(var(--indigo))",
          light: "hsl(var(--indigo-light))",
        },
        orange: {
          DEFAULT: "hsl(var(--orange))",
          light: "hsl(var(--orange-light))",
        },
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Consolas", "Monaco", "Courier New", "monospace"],
      },

      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 2px 8px rgb(0 0 0 / 0.08)",
        md: "0 4px 12px rgb(0 0 0 / 0.1)",
        lg: "0 8px 24px rgb(0 0 0 / 0.12)",
        "glow-accent": "0 0 40px 10px hsl(var(--accent) / 0.7)",
      },

      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "slow-gradient-shift": {
          "0%": { backgroundImage: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)" },
          "25%": { backgroundImage: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--accent)) 100%)" },
          "50%": { backgroundImage: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)" },
          "75%": { backgroundImage: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)" },
          "100%": { backgroundImage: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%)" },
        },
        "collapsible-slide-down": {
          from: { width: "0", opacity: "0" },
          to: { width: "var(--radix-collapsible-content-width)", opacity: "1" },
        },
        "collapsible-slide-up": {
          from: { width: "var(--radix-collapsible-content-width)", opacity: "1" },
          to: { width: "0", opacity: "0" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 30s linear infinite",
        "slow-gradient": "slow-gradient-shift 60s ease-in-out infinite alternate",
        "collapsible-slide-down": "collapsible-slide-down 150ms ease-out",
        "collapsible-slide-up": "collapsible-slide-up 150ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), gradientPlugin],
}
