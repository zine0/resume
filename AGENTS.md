# AGENTS.md — Resume Builder Project Guide

> AI agent orientation file. Read this before modifying any code in this project.

## Project Overview

A browser-based resume builder that stores all data in `localStorage`. Users create, edit, preview, and export resumes (PDF/PNG/JPG/WEBP/SVG/JSON). The app is a single-page-style Next.js application with server-side PDF generation via Puppeteer.

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Shadcn UI · Tiptap 3 · puppeteer-core + @sparticuz/chromium · @hello-pangea/dnd · Iconify

**Package Manager**: pnpm (always use `pnpm`, never npm or yarn)

## Architecture

### Rendering Model

- **Pages are Server Components by default** (App Router convention)
- **All interactive components use `"use client"`** — this is a heavily client-side app
- Server-side code exists only in: `middleware.ts`, `app/api/` routes, and `app/layout.tsx`
- PDF generation: Server launches headless Chromium, navigates to `/print`, renders the same HTML/CSS as the preview, returns PDF

### Data Flow

```
localStorage ←→ lib/storage.ts ←→ Page Components ←→ Editor Components
                                        ↕
                                   ResumePreview (shared HTML/CSS)
                                        ↕
                              /print page ← Puppeteer ← /api/pdf
```

- **No backend database**. All resume data lives in browser `localStorage` under key `"resume.entries"`
- `lib/storage.ts` is the sole interface to localStorage — never access `window.localStorage` directly
- `lib/utils.ts` contains data factories (`createDefaultResumeData`, `createNewModule`, etc.), validation, and export/import logic
- `types/resume.ts` defines all data structures

### Routing

| Route | Purpose | Key Component |
|-------|---------|---------------|
| `/` | User center — manage all resumes | `user-center.tsx` |
| `/edit/new` | Create new resume (supports `?clone=ID`, `?example=1`) | `resume-builder.tsx` |
| `/edit/[id]` | Edit existing resume | `resume-builder.tsx` |
| `/view/[id]` | Read-only preview | `resume-preview.tsx` |
| `/print` | Print container for Puppeteer | `print-content.tsx` |
| `/auth` | Password login (optional) | `auth-form.tsx` |
| `/api/pdf` | Generate PDF | puppeteer-core |
| `/api/pdf/[filename]` | Cached PDF download | POST→303→GET pattern |
| `/api/pdf/health` | Headless browser check | — |
| `/api/auth` | Password authentication | SHA-256 cookie |
| `/api/image-proxy` | CORS proxy for exports | Edge runtime |

### Component Hierarchy

```
RootLayout (providers: Theme, ColorPicker, Toolbar)
└── Page (Server Component)
    └── Client Component (user-center | resume-builder | resume-preview | auth-form)
        ├── Editors: personal-info-editor, job-intention-editor, module-editor, rich-text-input
        ├── Preview: resume-preview → rich-text-renderer
        ├── Export: export-button (PDF/PNG/JPG/WEBP/SVG/JSON)
        └── Shared: color-picker*, icon-picker, tag-input, floating-action-bar, pdf-viewer
```

## Conventions

### TypeScript

- **Strict mode** is enabled — no `as any`, `@ts-ignore`, or `@ts-expect-error`
- **Interfaces** for data shapes (ResumeData, PersonalInfoItem, etc.)
- **Types** for unions and utility types (StorageErrorCode, ViewMode, etc.)
- **Custom error class** `StorageError` in `lib/storage.ts` with typed codes: `UNAVAILABLE`, `PARSE_ERROR`, `QUOTA_EXCEEDED`, `UNKNOWN`
- Path alias: `@/*` → project root

### Imports

Always use absolute paths with the `@/` alias:

```tsx
import { Button } from "@/components/ui/button"
import type { ResumeData } from "@/types/resume"
import { createDefaultResumeData } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
```

### Components

- **Functional components only**, no class components
- **`memo()`** used selectively for performance (e.g., ViewModeSelector in resume-builder.tsx)
- **File naming**: kebab-case (`resume-builder.tsx`)
- **Component naming**: PascalCase (`ResumeBuilder`)
- **Shadcn UI components** live in `components/ui/` — use CVA variants, never modify directly, add new ones via `npx shadcn@latest add <component>`
- **"use client"** directive required for any component with hooks, event handlers, or browser APIs

### Styling

- **Tailwind CSS v4** with PostCSS — uses `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- **CSS custom properties** in `oklch` color space in `styles/globals.css`
- **`@theme inline`** block maps CSS vars to Tailwind tokens
- **`@layer components`** for reusable utility classes (`.resume-editor`, `.editor-toolbar`, etc.)
- **Print styles** in `styles/print.css` and `@media print` blocks
- **`cn()`** from `@/lib/utils` for conditional class merging (uses `clsx` + `tailwind-merge`)
- **Dedicated CSS files**: `styles/tiptap.css` for rich editor, `styles/globals.css` for Tailwind base

### State Management

- **Pure React hooks**: `useState`, `useEffect`, `useCallback`, `useMemo`
- **No external state library** (no Redux, Zustand, etc.)
- **Context providers**: `ColorPickerProvider`, `ToolbarProvider`, `ThemeProvider` (next-themes)
- **Props drilling** for parent→child state flow
- **localStorage** via `lib/storage.ts` for persistence

### Error Handling

- **Client-side**: `try/catch` + `toast()` notifications from `@/hooks/use-toast`
- **Storage errors**: Check `instanceof StorageError` and `e.code` for specific handling
- **API routes**: Return JSON `{ error: message }` with appropriate HTTP status codes
- **PDF fallback**: If server PDF fails, automatically falls back to browser `window.print()`

### Naming Patterns

| Category | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `ResumeBuilder` |
| Files | kebab-case | `resume-builder.tsx` |
| Hooks | camelCase, `use` prefix | `useToast`, `useMobile` |
| Utilities | camelCase | `createDefaultResumeData`, `downloadFile` |
| Types/Interfaces | PascalCase | `ResumeData`, `PersonalInfoItem` |
| CSS classes | kebab-case | `.resume-editor`, `.editor-toolbar` |
| Env variables | SCREAMING_SNAKE | `SITE_PASSWORD`, `NEXT_PUBLIC_FORCE_SERVER_PDF` |

## Key Files to Read First

When working on this project, familiarize yourself with these files in order:

1. **`types/resume.ts`** — All data structures. Everything flows from these types.
2. **`lib/storage.ts`** — How data is loaded/saved. Understand the StorageError class.
3. **`lib/utils.ts`** — Factory functions, validation, export/import. Large file with many utilities.
4. **`components/resume-builder.tsx`** — Main editor. Shows state management and component composition patterns.
5. **`components/resume-preview.tsx`** — Preview rendering. Must stay in sync with print output.
6. **`styles/globals.css`** — Theme tokens, Tailwind config, component utility classes.

## Common Tasks

### Adding a New Editor Field

1. Add/update the type in `types/resume.ts`
2. Add factory defaults in `lib/utils.ts` (e.g., `createDefaultResumeData`)
3. Create or modify the editor component in `components/`
4. Update `resume-preview.tsx` to render the new field
5. Verify `print-content.tsx` renders it correctly for PDF output

### Adding a New Shadcn UI Component

```bash
npx shadcn@latest add <component-name>
```

Never manually create files in `components/ui/`. Always use the CLI. The project uses the `new-york` style variant.

### Adding a New API Route

- Place in `app/api/<route-name>/route.ts`
- Export named functions (`GET`, `POST`, etc.)
- Add `export const runtime = "nodejs"` for Node.js APIs
- Add `export const runtime = "edge"` for lightweight edge APIs
- Return JSON errors: `new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } })`

### Modifying PDF Output

- The PDF renders the **same HTML/CSS** as the preview — changes to `resume-preview.tsx` affect both
- Print-specific overrides go in `styles/print.css` or `@media print` blocks in `globals.css`
- The `/print` page reads resume data from URL parameter or `sessionStorage` (key: `"resumeData"`)
- Server-side PDF config is in `app/api/pdf/route.ts` (page size, margins, etc.)

### Modifying Theme/Colors

- Edit CSS custom properties in `styles/globals.css` (`:root` and `.dark` selectors)
- Uses `oklch` color space — maintain oklch format when changing values
- The `@theme inline` block maps CSS vars to Tailwind utility classes

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `SITE_PASSWORD` | Optional password protection for the entire site | No |
| `NEXT_PUBLIC_FORCE_SERVER_PDF` | Force server-side PDF generation | No |
| `NEXT_PUBLIC_FORCE_PRINT` | Force browser print instead of server PDF | No |
| `PUPPETEER_EXECUTABLE_PATH` | Path to Chrome binary (alternative to bundled Chromium) | No |
| `CHROME_PATH` | Same as above, alternative env var name | No |

## Build & Dev Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build (ignores ESLint/TS errors per next.config.mjs)
pnpm start            # Start production server
pnpm lint             # Run ESLint
```

**Note**: `next.config.mjs` has `ignoreDuringBuilds: true` for both ESLint and TypeScript. Pre-existing type errors exist. Do not introduce new ones.

## Gotchas

- **localStorage quota**: `lib/storage.ts` handles quota exceeded errors gracefully. When adding large data fields, test with multiple resumes saved.
- **PDF/Preview parity**: The HTML rendered in `resume-preview.tsx` must match what Puppeteer sees at `/print`. Any CSS difference will cause PDF output to diverge from preview.
- **Image handling**: Avatar URLs can be data URLs or remote URLs. Remote images are proxied through `/api/image-proxy` for export to avoid canvas tainting.
- **Rich text**: Tiptap stores content as `JSONContent` (ProseMirror doc format). Never try to parse it as plain HTML.
- **Drag and drop**: Uses `@hello-pangea/dnd` (not `react-beautiful-dnd`). The API is similar but the import is different.
- **Tailwind v4 syntax**: This project uses Tailwind v4, not v3. Configuration is via CSS (`@theme inline`), not `tailwind.config.js`. Do not create a `tailwind.config.js` file.
- **No tests**: The project has no testing framework. If adding tests, use Vitest (consistent with the ecosystem).

## Deployment

- **Vercel**: Node.js serverless functions only (not Edge). Set function timeout to 120s, memory to 1024MB+.
- **EdgeOne Pages**: Also supported per README.
- The `app/api/pdf/route.ts` exports `maxDuration = 120` for Vercel serverless.
