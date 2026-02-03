# CCW Monorepo Guide

This document describes the monorepo structure for CCW, which includes the frontend application and documentation site.

## 🏗️ Monorepo Structure

```
ccw/
├── frontend/          # React + Vite frontend application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── package.json  # Workspace: frontend
│
├── docs-site/        # Docusaurus documentation
│   ├── docs/         # Documentation content (MDX)
│   ├── i18n/         # Internationalization
│   ├── src/          # Custom theme/components
│   └── package.json  # Workspace: docs-site
│
├── package.json      # Root package (workspaces config)
├── .npmrc           # npm configuration
└── MONOREPO.md      # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install all dependencies (workspaces)
npm install
```

This installs dependencies for both `frontend` and `docs-site` workspaces, with shared dependencies hoisted to the root `node_modules`.

### Development

```bash
# Start frontend only (port 5173, with /docs proxied to Docusaurus at 3001)
npm run dev

# Start documentation only (port 3001)
npm run dev:docs

# Start both concurrently (recommended)
npm run dev:all
```

**Access the application:**
- Frontend: http://localhost:5173
- Documentation: http://localhost:5173/docs (proxied to Docusaurus at 3001)

## 📚 Available Scripts

### Root Commands (from ccw/)

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Start frontend dev server (with docs proxy) |
| `npm run dev:docs` | Start Docusaurus dev server |
| `npm run dev:all` | Start both servers concurrently |
| `npm run build` | Build all workspaces |
| `npm run build:frontend` | Build frontend only |
| `npm run build:docs` | Build documentation only |
| `npm run clean` | Clean all build artifacts |
| `npm run clean:node_modules` | Remove all node_modules |
| `npm run lint` | Lint frontend code |
| `npm run test` | Run frontend tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run validate` | Validate i18n translations |
| `npm run serve` | Serve docs production build |
| `npm run preview` | Preview frontend production build |

### Workspace-Specific Commands

```bash
# Frontend workspace
cd frontend
npm run dev           # Start Vite dev server
npm run build         # Build for production
npm run test          # Run unit tests
npm run lint          # Lint code

# Documentation workspace
cd docs-site
npm start             # Start Docusaurus dev server
npm run build         # Build static site
npm run serve         # Serve production build
```

## 📦 Workspaces

### Frontend (`frontend/`)

React + Vite + TypeScript application with:
- Radix UI components
- Tailwind CSS styling
- React Router v6
- React Intl (i18n)
- Zustand (state management)
- Vitest (testing)

**Tech Stack:**
- Runtime: React 18.3
- Build: Vite 6.0
- Language: TypeScript 5.6
- Styling: Tailwind CSS 3.4

### Documentation (`docs-site/`)

Docusaurus 3.x documentation site with:
- 40+ command references
- 15 workflow guides
- Mermaid diagrams
- MDX support
- i18n (EN/ZH)

**Tech Stack:**
- Framework: Docusaurus 3.5
- Docs: MDX (Markdown + JSX)
- Diagrams: Mermaid
- Styling: Custom CSS with CCW theme

## 🎨 Features

- **40+ Commands**: workflow, issue, cli, memory, general categories
- **15 Workflow Levels**: From ultra-lightweight to intelligent orchestration
- **AI-Powered**: Multi-CLI collaboration with intelligent routing
- **Bilingual**: English and Chinese support
- **Themeable**: Light/dark mode with CCW design tokens
- **Interactive**: Mermaid workflow diagrams and live examples

## 🔧 Configuration

### Workspace Management

Root `package.json` defines workspaces:

```json
{
  "workspaces": [
    "frontend",
    "docs-site"
  ]
}
```

Dependencies are **hoisted** to root `node_modules` automatically by npm.

### Adding Dependencies

```bash
# Add to specific workspace
npm install <package> --workspace=frontend
npm install <package> --workspace=docs-site

# Add to root (shared)
npm install <package> -w .

# Add as dev dependency
npm install <package> --workspace=frontend --save-dev
```

## 📖 Documentation

Full documentation is available at:
- **Development**: http://localhost:5173/docs
- **Standalone**: http://localhost:3001 (when `npm run dev:docs`)

Documentation source files are in `docs-site/docs/`:
- `overview.mdx` - Getting started
- `commands/` - Command references by category
- `workflows/` - Workflow guides and levels
- `faq.mdx` - Frequently asked questions

## 🌍 Internationalization

- **Frontend**: `frontend/src/locales/{en,zh}/`
- **Docs**: `docs-site/i18n/zh/docusaurus-plugin-content-docs/current/`

## 🧪 Testing

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E UI mode
npm run test:e2e:ui
```

## 📦 Building for Production

```bash
# Build all workspaces
npm run build

# Output directories:
# - frontend/dist/
# - docs-site/build/
```

## 🚢 Deployment

### Frontend

Deploy `frontend/dist/` to any static hosting service:
- Vercel, Netlify, AWS S3, etc.

### Documentation

Documentation is integrated as `/docs` route in the frontend.
For standalone deployment, deploy `docs-site/build/`.

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name ccw.example.com;

    # Frontend (with docs proxy)
    location / {
        root /var/www/ccw/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Fallback: standalone docs
    location /docs {
        root /var/www/ccw/docs-site/build;
        try_files $uri $uri/ /docs/index.html;
    }
}
```

## 🔗 Resources

- [Docusaurus Documentation](https://docusaurus.io/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)

---

**Built with ❤️ by the CCW Team**
