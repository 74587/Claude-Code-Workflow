/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/templates/**/*.html",
    "./src/**/*.py",
    "./static/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        // Base colors
        background: "hsl(var(--color-background))",
        foreground: "hsl(var(--color-foreground))",
        card: {
          DEFAULT: "hsl(var(--color-card))",
          foreground: "hsl(var(--color-card-foreground))",
        },
        border: "hsl(var(--color-border))",
        input: "hsl(var(--color-input))",
        ring: "hsl(var(--color-ring))",

        // Interactive colors
        primary: {
          DEFAULT: "hsl(var(--color-interactive-primary-default))",
          hover: "hsl(var(--color-interactive-primary-hover))",
          active: "hsl(var(--color-interactive-primary-active))",
          disabled: "hsl(var(--color-interactive-primary-disabled))",
          foreground: "hsl(var(--color-interactive-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--color-interactive-secondary-default))",
          hover: "hsl(var(--color-interactive-secondary-hover))",
          active: "hsl(var(--color-interactive-secondary-active))",
          disabled: "hsl(var(--color-interactive-secondary-disabled))",
          foreground: "hsl(var(--color-interactive-secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--color-interactive-accent-default))",
          hover: "hsl(var(--color-interactive-accent-hover))",
          active: "hsl(var(--color-interactive-accent-active))",
          foreground: "hsl(var(--color-interactive-accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--color-interactive-destructive-default))",
          hover: "hsl(var(--color-interactive-destructive-hover))",
          foreground: "hsl(var(--color-interactive-destructive-foreground))",
        },

        // Semantic colors
        muted: {
          DEFAULT: "hsl(var(--color-muted))",
          foreground: "hsl(var(--color-muted-foreground))",
        },

        // Sidebar colors
        sidebar: {
          background: "hsl(var(--color-sidebar-background))",
          foreground: "hsl(var(--color-sidebar-foreground))",
          primary: "hsl(var(--color-sidebar-primary))",
          "primary-foreground": "hsl(var(--color-sidebar-primary-foreground))",
          accent: "hsl(var(--color-sidebar-accent))",
          "accent-foreground": "hsl(var(--color-sidebar-accent-foreground))",
          border: "hsl(var(--color-sidebar-border))",
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "Consolas", "Monaco", "Courier New", "monospace"],
      },

      fontSize: {
        xs: "var(--font-size-xs)",
        sm: "var(--font-size-sm)",
        base: "var(--font-size-base)",
        lg: "var(--font-size-lg)",
        xl: "var(--font-size-xl)",
        "2xl": "var(--font-size-2xl)",
        "3xl": "var(--font-size-3xl)",
        "4xl": "var(--font-size-4xl)",
      },

      lineHeight: {
        tight: "var(--line-height-tight)",
        normal: "var(--line-height-normal)",
        relaxed: "var(--line-height-relaxed)",
      },

      letterSpacing: {
        tight: "var(--letter-spacing-tight)",
        normal: "var(--letter-spacing-normal)",
        wide: "var(--letter-spacing-wide)",
      },

      spacing: {
        0: "var(--spacing-0)",
        1: "var(--spacing-1)",
        2: "var(--spacing-2)",
        3: "var(--spacing-3)",
        4: "var(--spacing-4)",
        6: "var(--spacing-6)",
        8: "var(--spacing-8)",
        12: "var(--spacing-12)",
        16: "var(--spacing-16)",
      },

      borderRadius: {
        sm: "var(--border-radius-sm)",
        md: "var(--border-radius-md)",
        lg: "var(--border-radius-lg)",
        xl: "var(--border-radius-xl)",
        DEFAULT: "var(--border-radius-default)",
      },

      boxShadow: {
        "2xs": "var(--shadow-2xs)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },

      opacity: {
        disabled: "var(--opacity-disabled)",
        hover: "var(--opacity-hover)",
        active: "var(--opacity-active)",
      },

      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        medium: "var(--duration-medium)",
        slow: "var(--duration-slow)",
      },

      transitionTimingFunction: {
        linear: "var(--easing-linear)",
        "ease-in": "var(--easing-ease-in)",
        "ease-out": "var(--easing-ease-out)",
        "ease-in-out": "var(--easing-ease-in-out)",
        spring: "var(--easing-spring)",
      },

      animation: {
        // Add custom animations here if needed
      },

      keyframes: {
        // Add custom keyframes here if needed
      },
    },
  },
  plugins: [],
}
