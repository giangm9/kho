# Project Structure

Clean and organized structure for the Kho library.

```
kho/
├── .claude/                    # Claude AI context
│   ├── project-context.md     # Architecture & design philosophy
│   ├── ROADMAP.md             # Implementation roadmap
│   └── PROJECT_STRUCTURE.md   # This file
│
├── src/                        # Library source code
│   └── index.ts               # Main entry point
│
├── tests/                      # Unit tests (Vitest)
│   ├── phase1/                # Phase 1 tests
│   │   └── store.test.ts
│   ├── utils/                 # Test utilities
│   │   └── test-helpers.ts
│   ├── vitest.config.ts       # Vitest config
│   └── README.md
│
├── demos/                      # React demos
│   ├── src/
│   │   ├── index.html         # Entry HTML
│   │   ├── main.tsx           # React entry
│   │   ├── App.tsx            # Main demo app
│   │   ├── styles.css         # Global styles
│   │   ├── 01-basic-counter/  # Phase 1 demo
│   │   │   ├── BasicCounter.tsx
│   │   │   └── README.md
│   │   └── README.md
│   ├── vite.config.ts         # Vite config
│   └── README.md
│
├── scripts/                    # Build & deployment
│   ├── build.ts               # Build library
│   └── deploy.ts              # Publish to npm
│
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config (shared)
├── .gitignore
└── README.md                  # Main documentation
```

## Directories Explained

### `/src` - Library Code
Contains the actual Kho library implementation. This is what gets published to npm.

**Key files:**
- `index.ts` - Main exports (atom, Store, scope, etc.)

### `/tests` - Unit Tests
All tests using Vitest. Organized by implementation phase.

**Key files:**
- `phase1/store.test.ts` - Phase 1 tests
- `utils/test-helpers.ts` - Shared test utilities

**Commands:**
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```

### `/demos` - React Demos
Interactive examples showing Kho features. Built with React + Vite.

**Structure:**
- Each demo is in its own directory (`01-basic-counter/`, etc.)
- Each demo has a React component and README

**Commands:**
```bash
npm run dev           # Start dev server (http://localhost:3000)
```

### `/scripts` - Build Scripts
TypeScript scripts for building and deploying.

**Files:**
- `build.ts` - Build ESM and CJS bundles
- `deploy.ts` - Publish to npm

**Commands:**
```bash
npm run build         # Build library
npm run deploy        # Deploy to npm
```

### `/.claude` - AI Context
Documentation for Claude AI to understand the project.

**Files:**
- `project-context.md` - Detailed architecture
- `ROADMAP.md` - Implementation phases

## Build Outputs

```
dist/                 # Library build (npm package)
├── index.js          # ESM bundle
├── index.cjs         # CommonJS bundle
├── index.d.ts        # TypeScript definitions
└── *.map             # Source maps

dist-demos/           # Demos build (for hosting)
```

Both are gitignored.

## Configuration Files

- **package.json** - Dependencies, scripts, npm metadata
- **tsconfig.json** - TypeScript compiler options (strict mode)
- **vite.config.ts** - Vite configuration for demos
- **vitest.config.ts** - Vitest configuration for tests
- **.gitignore** - Git ignore rules

## Key Concepts

1. **Separation of Concerns**
   - Library code (`/src`) is separate from demos (`/demos`) and tests (`/tests`)
   - Each module has its own README

2. **Phase-Based Organization**
   - Tests organized by phase (`tests/phase1/`, `tests/phase2/`, etc.)
   - Demos organized by phase (`01-basic-counter/`, `02-reactive-counter/`, etc.)

3. **Clean Dependencies**
   - Library has zero runtime dependencies
   - React/Vite only for demos (devDependencies)
   - Clear separation between library and tooling

4. **Developer Experience**
   - Single command to start developing (`npm run dev`)
   - Fast hot reload with Vite
   - Fast tests with Vitest
   - Clear documentation in each directory
