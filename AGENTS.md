# AGENTS.md — Resume Builder Project Guide

> AI agent orientation file. Read this before modifying any code in this project.

## Project Overview

This project is a desktop resume builder built with **Tauri v2 + Vite + React Router**. Users can create, edit, preview, and export resumes as PDF, PNG, JPG, WEBP, SVG, and JSON. The frontend is a React single-page application, while persistence and PDF generation are handled by Rust commands exposed through Tauri.

**Stack**: Tauri v2 · Vite 6 · React 19 · React Router 7 · TypeScript (strict) · Tailwind CSS v4 · Shadcn UI · Tiptap 3 · Rust · `headless_chrome` · `@hello-pangea/dnd` · Iconify

**Package Manager**: pnpm (always use `pnpm`, never npm or yarn)

## Architecture

### Runtime Model

- The frontend is a **Vite React SPA** mounted from `src/main.tsx`
- Routing is handled by **React Router** in `src/App.tsx`
- Browser-side business logic lives in React components, hooks, and `lib/`
- Native capabilities live in `src-tauri/` and are exposed through `invoke(...)`
- PDF generation is **desktop-native**: frontend builds printable HTML, Rust launches headless Chrome, renders that HTML, and writes a PDF into the app data directory

### Data Flow

```text
React UI ←→ lib/storage.ts ←→ Tauri invoke() ←→ Rust commands ←→ app data directory
      ↘
       ResumePreview / PrintContent ←→ HTML export / PDF generation
```

- Resume data is no longer stored in browser `localStorage`
- `lib/storage.ts` is the sole frontend interface for resume persistence and resume-related backend helpers
- Rust storage code persists resume entries in the app data directory as `resumes.json`
- `lib/utils.ts` contains frontend utilities such as formatting helpers, export helpers, factories, and data normalization
- `types/resume.ts` defines the shared TypeScript data structures used throughout the frontend

### Routing

Defined in `src/App.tsx`:

| Route       | Purpose                                                            | Key Component               |
| ----------- | ------------------------------------------------------------------ | --------------------------- |
| `/`         | Resume list / user center                                          | `src/routes/Home.tsx`       |
| `/edit/new` | Create a new resume, optionally from clone/example/prefetched data | `src/routes/EditNew.tsx`    |
| `/edit/:id` | Edit an existing resume                                            | `src/routes/EditResume.tsx` |
| `/view/:id` | Read-only preview                                                  | `src/routes/ViewResume.tsx` |
| `/print`    | Print-friendly rendering surface                                   | `src/routes/Print.tsx`      |

### Tauri Backend Surface

Registered in `src-tauri/src/lib.rs`:

- AI config commands: `get_ai_config`, `save_ai_config`
- Resume helpers: `get_default_resume_data`, `validate_resume_data_command`, `import_resume_file`, `export_resume_file`
- Resume structure factories: `create_personal_info_item`, `create_job_intention_item`, `create_resume_module`, `create_rich_text_row`, `create_tags_row`
- Storage commands: `get_all_resumes`, `get_resume_by_id`, `create_resume`, `create_resume_from_data`, `update_resume`, `delete_resumes`
- Export command: `generate_pdf`

### Storage Model

- Frontend calls `invoke(...)` through `lib/storage.ts`
- Rust storage implementation lives in `src-tauri/src/storage.rs`
- Data is written to the Tauri app data directory, currently in `resumes.json`
- Legacy data parsing/migration is handled in Rust when older storage formats are encountered
- Storage failures are mapped into typed frontend `StorageError`s

### PDF / Export Model

- Image and JSON exports are initiated from frontend components such as `components/export-button.tsx`
- Desktop save flows use `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`
- PDF generation is implemented in `src-tauri/src/pdf.rs`
- Rust writes a temporary HTML file, renders it through `headless_chrome`, and stores the generated PDF in the app data directory
- Frontend save flows may copy generated PDFs into a user-selected destination, so Tauri FS capabilities must stay in sync with `copyFile` usage

## Conventions

### TypeScript

- **Strict mode** is enabled — no `as any`, `@ts-ignore`, or `@ts-expect-error`
- Prefer **interfaces** for domain data shapes and **types** for unions/utilities
- `StorageError` in `lib/storage.ts` is the canonical frontend error type for storage/backend failures
- Path alias: `@/*` → project root

### Imports

Always use the `@/` alias for project-local imports:

```tsx
import { Button } from '@/components/ui/button'
import type { ResumeData } from '@/types/resume'
import { getAllResumes } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'
```

### Components

- Functional components only
- File naming: kebab-case
- Component naming: PascalCase
- This is a Vite React app, so **do not add Next.js-only directives like `"use client"`**
- `components/ui/` contains Shadcn UI primitives; avoid hand-editing generated patterns unless necessary

### Styling

- Tailwind CSS v4 with PostCSS
- Global styles: `styles/globals.css`
- Print styles: `styles/print.css`
- Tiptap styles: `styles/tiptap.css`
- Use `cn()` from `@/lib/utils` for conditional class composition

### State Management

- React hooks and local component state
- Shared UI state via providers in `src/App.tsx`:
  - `ThemeProvider`
  - `ColorPickerProvider`
  - `ToolbarProvider`
- No Redux/Zustand or other external state container

### Error Handling

- Frontend: `try/catch` + toast-based user feedback
- Backend: Rust commands return `Result<_, String>` and errors are mapped on the frontend
- Quota / backend availability / unknown errors should be surfaced through `StorageError`

### Naming Patterns

| Category         | Convention                  | Example                              |
| ---------------- | --------------------------- | ------------------------------------ |
| Components       | PascalCase                  | `ResumeBuilder`                      |
| Files            | kebab-case                  | `resume-builder.tsx`                 |
| Hooks            | camelCase with `use` prefix | `useToast`                           |
| Utilities        | camelCase                   | `generatePdfFilename`                |
| Types/Interfaces | PascalCase                  | `ResumeData`, `StoredResume`         |
| CSS classes      | kebab-case                  | `.resume-preview`, `.editor-toolbar` |

## Key Files to Read First

When working on this project, start with these files:

1. `types/resume.ts` — core resume data model
2. `lib/storage.ts` — frontend-to-Tauri persistence and helper API
3. `src-tauri/src/lib.rs` — Tauri plugin setup and command registration
4. `src-tauri/src/storage.rs` — native storage implementation
5. `src-tauri/src/resume.rs` — validation and resume helper constructors
6. `src-tauri/src/pdf.rs` — desktop PDF generation
7. `components/resume-builder.tsx` — main editing surface
8. `components/resume-preview.tsx` — canonical preview rendering
9. `src/App.tsx` — route and provider composition

## Common Tasks

### Adding a New Resume Field

1. Update the TypeScript types in `types/resume.ts`
2. Update validation / normalization in Rust if needed (`src-tauri/src/resume.rs`)
3. Update any frontend factories or helpers in `lib/utils.ts` or `lib/storage.ts`
4. Update editor UI in `components/`
5. Update `components/resume-preview.tsx` and print-related rendering if needed
6. Verify create/edit/view/export flows still work

### Adding a New Tauri Command

1. Implement the command in the relevant Rust module under `src-tauri/src/`
2. Register it in `src-tauri/src/lib.rs`
3. Add a typed frontend wrapper if the command is consumed from React code
4. If the command depends on plugin capabilities, update `src-tauri/capabilities/default.json`
5. Verify through `pnpm tauri:build`

### Modifying Export Behavior

- Image / SVG / JSON export flows are primarily in `components/export-button.tsx`
- PDF rendering is triggered through Tauri `generate_pdf`
- Print-specific UI uses `/print` + `components/print-content.tsx`
- If save/copy behavior changes, re-check Tauri `dialog` and `fs` permissions

### Modifying Persistence

- Frontend persistence calls should go through `lib/storage.ts`
- Native persistence logic belongs in `src-tauri/src/storage.rs`
- Do not bypass the storage abstraction from UI code

## Environment / Config

### Frontend and Tauri Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm tauri:dev
pnpm tauri:build
```

### Key Config Files

- `package.json` — frontend and Tauri scripts
- `vite.config.ts` — Vite config and aliasing
- `src-tauri/tauri.conf.json` — Tauri app identifier, window config, build hooks
- `src-tauri/capabilities/default.json` — Tauri runtime permissions

## Gotchas

- `lib/storage.ts` no longer represents browser `localStorage`; it is a Tauri backend adapter
- `ThemeProvider` still uses a browser storage key (`resume-theme`) for theme persistence, which is separate from resume data persistence
- Desktop export flows rely on Tauri FS/dialog permissions; missing capabilities can break otherwise-correct UI code
- PDF generation depends on `headless_chrome`; machine-specific Chrome availability can affect desktop PDF behavior
- The `/print` route is still part of the SPA and is used as a print/render target, not as a server route
- Do not reintroduce Next.js concepts like `app/`, server components, API route handlers, `middleware.ts`, or `"use client"`

## Deployment / Packaging

- This is a **desktop app**, not a Vercel/App Router deployment target
- Desktop packaging is handled through Tauri via `pnpm tauri:build`
- Cross-platform packaging and runtime validation should be checked on target OSes when changing native behavior
