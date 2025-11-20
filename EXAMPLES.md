# 📖 Claude Code Workflow - Real-World Examples

This document provides practical, real-world examples of using CCW for common development tasks.

---

## 📋 Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Web Development](#web-development)
- [API Development](#api-development)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Refactoring](#refactoring)
- [UI/UX Design](#uiux-design)
- [Bug Fixes](#bug-fixes)
- [Documentation](#documentation)
- [DevOps & Automation](#devops--automation)
- [Complex Projects](#complex-projects)

---

## 🚀 Quick Start Examples

### Example 1: Simple Express API

**Objective**: Create a basic Express.js API with CRUD operations

```bash
# Option 1: Lite workflow (fastest)
/workflow:lite-plan "Create Express API with CRUD endpoints for users (GET, POST, PUT, DELETE)"

# Option 2: Full workflow (more structured)
/workflow:plan "Create Express API with CRUD endpoints for users"
/workflow:execute
```

**What CCW does**:
1. Analyzes your project structure
2. Creates Express app setup
3. Implements CRUD routes
4. Adds error handling middleware
5. Creates basic tests

**Result**:
```
src/
├── app.js              # Express app setup
├── routes/
│   └── users.js        # User CRUD routes
├── controllers/
│   └── userController.js
└── tests/
    └── users.test.js
```

### Example 2: React Component

**Objective**: Create a React login form component

```bash
/workflow:lite-plan "Create a React login form component with email and password fields, validation, and submit handling"
```

**What CCW does**:
1. Creates LoginForm component
2. Adds form validation (email format, password requirements)
3. Implements state management
4. Adds error display
5. Creates component tests

**Result**:
```jsx
// components/LoginForm.jsx
import React, { useState } from 'react';

export function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  // ... validation and submit logic
}
```

---

## 🌐 Web Development

### Example 3: Full-Stack Todo Application

**Objective**: Build a complete todo application with React frontend and Express backend

#### Phase 1: Planning with Brainstorming

```bash
# Multi-perspective analysis
/workflow:brainstorm:auto-parallel "Full-stack todo application with user authentication, real-time updates, and dark mode"

# Review brainstorming artifacts
# Then create implementation plan
/workflow:plan

# Verify plan quality
/workflow:action-plan-verify
```

**Brainstorming generates**:
- System architecture analysis
- UI/UX design recommendations
- Data model design
- Security considerations
- API design patterns

#### Phase 2: Implementation

```bash
# Execute the plan
/workflow:execute

# Monitor progress
/workflow:status
```

**What CCW implements**:

**Backend** (`server/`):
- Express server setup
- MongoDB/PostgreSQL integration
- JWT authentication
- RESTful API endpoints
- WebSocket for real-time updates
- Input validation middleware

**Frontend** (`client/`):
- React app with routing
- Authentication flow
- Todo CRUD operations
- Real-time updates via WebSocket
- Dark mode toggle
- Responsive design

#### Phase 3: Testing

```bash
# Generate comprehensive tests
/workflow:test-gen WFS-todo-application

# Execute test tasks
/workflow:execute

# Run iterative test-fix cycle
/workflow:test-cycle-execute
```

**Tests created**:
- Unit tests for components
- Integration tests for API
- E2E tests for user flows
- Authentication tests
- WebSocket connection tests

#### Phase 4: Quality Review

```bash
# Security review
/workflow:review --type security

# Architecture review
/workflow:review --type architecture

# General quality review
/workflow:review
```

**Complete session**:
```bash
/workflow:session:complete
```

---

### Example 4: E-commerce Product Catalog

**Objective**: Build product catalog with search, filters, and pagination

```bash
# Start with UI design exploration
/workflow:ui-design:explore-auto --prompt "Modern e-commerce product catalog with grid layout, filters sidebar, and search bar" --targets "catalog,product-card" --style-variants 3

# Review designs in compare.html
# Sync selected designs
/workflow:ui-design:design-sync --session <session-id> --selected-prototypes "catalog-v2,product-card-v1"

# Create implementation plan
/workflow:plan

# Execute
/workflow:execute
```

**Features implemented**:
- Product grid with responsive layout
- Search functionality with debounce
- Category/price/rating filters
- Pagination with infinite scroll option
- Product card with image, title, price, rating
- Sort options (price, popularity, newest)

---

## 🔌 API Development

### Example 5: RESTful API with Authentication

**Objective**: Create RESTful API with JWT authentication and role-based access control

```bash
# Detailed planning
/workflow:plan "RESTful API with JWT authentication, role-based access control (admin, user), and protected endpoints for posts resource"

# Verify plan
/workflow:action-plan-verify

# Execute
/workflow:execute
```

**Implementation includes**:

**Authentication**:
```javascript
// routes/auth.js
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

**Protected Resources**:
```javascript
// routes/posts.js
GET    /api/posts        # Public
GET    /api/posts/:id    # Public
POST   /api/posts        # Authenticated
PUT    /api/posts/:id    # Authenticated (owner or admin)
DELETE /api/posts/:id    # Authenticated (owner or admin)
```

**Middleware**:
- `authenticate` - Verifies JWT token
- `authorize(['admin'])` - Role-based access
- `validateRequest` - Input validation
- `errorHandler` - Centralized error handling

### Example 6: GraphQL API

**Objective**: Convert REST API to GraphQL

```bash
# Analyze existing REST API
/cli:analyze "Analyze REST API structure in src/routes/"

# Plan GraphQL migration
/workflow:plan "Migrate REST API to GraphQL with queries, mutations, and subscriptions for posts and users"

# Execute migration
/workflow:execute
```

**GraphQL schema created**:
```graphql
type Query {
  posts(limit: Int, offset: Int): [Post!]!
  post(id: ID!): Post
  user(id: ID!): User
}

type Mutation {
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  postUpdated: Post!
}
```

---

## 🧪 Testing & Quality Assurance

### Example 7: Test-Driven Development (TDD)

**Objective**: Implement user authentication using TDD approach

```bash
# Start TDD workflow
/workflow:tdd-plan "User authentication with email/password login, registration, and password reset"

# Execute (Red-Green-Refactor cycles)
/workflow:execute

# Verify TDD compliance
/workflow:tdd-verify
```

**TDD cycle tasks created**:

**Cycle 1: Registration**
1. `IMPL-1.1` - Write failing test for user registration
2. `IMPL-1.2` - Implement registration to pass test
3. `IMPL-1.3` - Refactor registration code

**Cycle 2: Login**
1. `IMPL-2.1` - Write failing test for login
2. `IMPL-2.2` - Implement login to pass test
3. `IMPL-2.3` - Refactor login code

**Cycle 3: Password Reset**
1. `IMPL-3.1` - Write failing test for password reset
2. `IMPL-3.2` - Implement password reset
3. `IMPL-3.3` - Refactor password reset

### Example 8: Adding Tests to Existing Code

**Objective**: Generate comprehensive tests for existing authentication module

```bash
# Create test generation workflow from existing code
/workflow:test-gen WFS-authentication-implementation

# Execute test tasks
/workflow:execute

# Run test-fix cycle until all tests pass
/workflow:test-cycle-execute --max-iterations 5
```

**Tests generated**:
- Unit tests for each function
- Integration tests for auth flow
- Edge case tests (invalid input, expired tokens, etc.)
- Security tests (SQL injection, XSS, etc.)
- Performance tests (load testing, rate limiting)

**Test coverage**: Aims for 80%+ coverage

---

## 🔄 Refactoring

### Example 9: Monolith to Microservices

**Objective**: Refactor monolithic application to microservices architecture

#### Phase 1: Analysis

```bash
# Deep architecture analysis
/cli:mode:plan --tool gemini "Analyze current monolithic architecture and create microservices migration strategy"

# Multi-role brainstorming
/workflow:brainstorm:auto-parallel "Migrate monolith to microservices with API gateway, service discovery, and message queue" --count 5
```

#### Phase 2: Planning

```bash
# Create detailed migration plan
/workflow:plan "Phase 1 microservices migration: Extract user service and auth service from monolith"

# Verify plan
/workflow:action-plan-verify
```

#### Phase 3: Implementation

```bash
# Execute migration
/workflow:execute

# Review architecture
/workflow:review --type architecture
```

**Microservices created**:
```
services/
├── user-service/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── auth-service/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── api-gateway/
│   ├── src/
│   └── config/
└── docker-compose.yml
```

### Example 10: Code Optimization

**Objective**: Optimize database queries for performance

```bash
# Analyze current performance
/cli:mode:code-analysis "Analyze database query performance in src/repositories/"

# Create optimization plan
/workflow:plan "Optimize database queries with indexing, query optimization, and caching"

# Execute optimizations
/workflow:execute
```

**Optimizations implemented**:
- Database indexing strategy
- N+1 query elimination
- Query result caching (Redis)
- Connection pooling
- Pagination for large datasets
- Database query monitoring

---

## 🎨 UI/UX Design

### Example 11: Design System Creation

**Objective**: Create a complete design system for a SaaS application

```bash
# Extract design from reference
/workflow:ui-design:imitate-auto --input "https://example-saas.com"

# Or create from scratch
/workflow:ui-design:explore-auto --prompt "Modern SaaS design system with primary components: buttons, inputs, cards, modals, navigation" --targets "button,input,card,modal,navbar" --style-variants 3
```

**Design system includes**:
- Color palette (primary, secondary, accent, neutral)
- Typography scale (headings, body, captions)
- Spacing system (4px grid)
- Component library:
  - Buttons (primary, secondary, outline, ghost)
  - Form inputs (text, select, checkbox, radio)
  - Cards (basic, elevated, outlined)
  - Modals (small, medium, large)
  - Navigation (sidebar, topbar, breadcrumbs)
- Animation patterns
- Responsive breakpoints

**Output**:
```
design-system/
├── tokens/
│   ├── colors.json
│   ├── typography.json
│   └── spacing.json
├── components/
│   ├── Button.jsx
│   ├── Input.jsx
│   └── ...
└── documentation/
    └── design-system.html
```

### Example 12: Responsive Landing Page

**Objective**: Design and implement a marketing landing page

```bash
# Design exploration
/workflow:ui-design:explore-auto --prompt "Modern SaaS landing page with hero section, features grid, pricing table, testimonials, and CTA" --targets "hero,features,pricing,testimonials" --style-variants 2 --layout-variants 3 --device-type responsive

# Select best designs and sync
/workflow:ui-design:design-sync --session <session-id> --selected-prototypes "hero-v2,features-v1,pricing-v3"

# Implement
/workflow:plan
/workflow:execute
```

**Sections implemented**:
- Hero section with animated background
- Feature cards with icons
- Pricing comparison table
- Customer testimonials carousel
- FAQ accordion
- Contact form
- Responsive navigation
- Dark mode support

---

## 🐛 Bug Fixes

### Example 13: Quick Bug Fix

**Objective**: Fix login button not working on mobile

```bash
# Analyze bug
/cli:mode:bug-index "Login button click event not firing on mobile Safari"

# Claude analyzes and implements fix
```

**Fix implemented**:
```javascript
// Before
button.onclick = handleLogin;

// After (adds touch event support)
button.addEventListener('click', handleLogin);
button.addEventListener('touchend', (e) => {
  e.preventDefault();
  handleLogin(e);
});
```

### Example 14: Complex Bug Investigation

**Objective**: Debug memory leak in React application

#### Investigation

```bash
# Start session for thorough investigation
/workflow:session:start "Memory Leak Investigation"

# Deep code analysis
/cli:mode:code-analysis --tool gemini "Analyze React component lifecycle and event listener management for potential memory leaks"

# Create fix plan
/workflow:plan "Fix memory leaks in React components: cleanup event listeners and cancel subscriptions"
```

#### Implementation

```bash
# Execute fixes
/workflow:execute

# Generate tests to prevent regression
/workflow:test-gen WFS-memory-leak-investigation

# Execute tests
/workflow:execute
```

**Issues found and fixed**:
1. Missing cleanup in `useEffect` hooks
2. Event listeners not removed
3. Uncancelled API requests on unmount
4. Large state objects not cleared

---

## 📝 Documentation

### Example 15: API Documentation Generation

**Objective**: Generate comprehensive API documentation

```bash
# Analyze existing API
/memory:load "Generate API documentation for all endpoints"

# Create documentation
/workflow:plan "Generate OpenAPI/Swagger documentation for REST API with examples and authentication info"

# Execute
/workflow:execute
```

**Documentation includes**:
- OpenAPI 3.0 specification
- Interactive Swagger UI
- Request/response examples
- Authentication guide
- Rate limiting info
- Error codes reference

### Example 16: Project README Generation

**Objective**: Create comprehensive README for open-source project

```bash
# Update project memory first
/memory:update-full --tool gemini

# Generate README
/workflow:plan "Create comprehensive README.md with installation, usage, examples, API reference, and contributing guidelines"

/workflow:execute
```

**README sections**:
- Project overview
- Features
- Installation instructions
- Quick start guide
- Usage examples
- API reference
- Configuration
- Contributing guidelines
- License

---

## ⚙️ DevOps & Automation

### Example 17: CI/CD Pipeline Setup

**Objective**: Set up GitHub Actions CI/CD pipeline

```bash
/workflow:plan "Create GitHub Actions workflow for Node.js app with linting, testing, building, and deployment to AWS"

/workflow:execute
```

**Pipeline created**:
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build
        run: npm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to AWS
        run: npm run deploy
```

### Example 18: Docker Containerization

**Objective**: Dockerize full-stack application

```bash
# Plan containerization
/workflow:plan "Dockerize full-stack app with React frontend, Express backend, PostgreSQL database, and Redis cache using docker-compose"

# Execute
/workflow:execute

# Review
/workflow:review --type architecture
```

**Created files**:
```
├── docker-compose.yml
├── frontend/
│   └── Dockerfile
├── backend/
│   └── Dockerfile
├── .dockerignore
└── README.docker.md
```

---

## 🏗️ Complex Projects

### Example 19: Real-Time Chat Application

**Objective**: Build real-time chat with WebSocket, message history, and file sharing

#### Complete Workflow

```bash
# 1. Brainstorm
/workflow:brainstorm:auto-parallel "Real-time chat application with WebSocket, message history, file upload, user presence, typing indicators" --count 5

# 2. UI Design
/workflow:ui-design:explore-auto --prompt "Modern chat interface with message list, input box, user sidebar, file preview" --targets "chat-window,message-bubble,user-list" --style-variants 2

# 3. Sync designs
/workflow:ui-design:design-sync --session <session-id>

# 4. Plan implementation
/workflow:plan

# 5. Verify plan
/workflow:action-plan-verify

# 6. Execute
/workflow:execute

# 7. Generate tests
/workflow:test-gen <session-id>

# 8. Execute tests
/workflow:execute

# 9. Review
/workflow:review --type security
/workflow:review --type architecture

# 10. Complete
/workflow:session:complete
```

**Features implemented**:
- WebSocket server (Socket.io)
- Real-time messaging
- Message persistence (MongoDB)
- File upload (S3/local storage)
- User authentication
- Typing indicators
- Read receipts
- User presence (online/offline)
- Message search
- Emoji support
- Mobile responsive

### Example 20: Data Analytics Dashboard

**Objective**: Build interactive dashboard with charts and real-time data

```bash
# Brainstorm data viz approach
/workflow:brainstorm:auto-parallel "Data analytics dashboard with real-time metrics, interactive charts, filters, and export functionality"

# Plan implementation
/workflow:plan "Analytics dashboard with Chart.js/D3.js, real-time data updates via WebSocket, date range filters, and CSV export"

# Execute
/workflow:execute
```

**Dashboard features**:
- Real-time metric cards (users, revenue, conversions)
- Line charts (trends over time)
- Bar charts (comparisons)
- Pie charts (distributions)
- Data tables with sorting/filtering
- Date range picker
- Export to CSV/PDF
- Responsive grid layout
- Dark mode
- WebSocket updates every 5 seconds

---

## 💡 Tips for Effective Examples

### Best Practices

1. **Start with clear objectives**
   - Define what you want to build
   - List key features
   - Specify technologies if needed

2. **Use appropriate workflow**
   - Simple tasks: `/workflow:lite-plan`
   - Complex features: `/workflow:brainstorm` → `/workflow:plan`
   - Existing code: `/workflow:test-gen` or `/cli:analyze`

3. **Leverage quality gates**
   - Run `/workflow:action-plan-verify` before execution
   - Use `/workflow:review` after implementation
   - Generate tests with `/workflow:test-gen`

4. **Maintain memory**
   - Update memory after major changes
   - Use `/memory:load` for quick context
   - Keep CLAUDE.md files up to date

5. **Complete sessions**
   - Always run `/workflow:session:complete`
   - Generates lessons learned
   - Archives session for reference

---

## 🔗 Related Resources

- [Getting Started Guide](GETTING_STARTED.md) - Basics
- [Architecture](ARCHITECTURE.md) - How it works
- [Command Reference](COMMAND_REFERENCE.md) - All commands
- [FAQ](FAQ.md) - Common questions
- [Contributing](CONTRIBUTING.md) - How to contribute

---

## 📬 Share Your Examples

Have a great example to share? Contribute to this document!

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2025-11-20
**Version**: 5.8.1
