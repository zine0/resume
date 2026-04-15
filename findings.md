# Findings

## Initial Discovery

- User referenced `doc/`, but repository uses `docs/`.
- `docs/remediation-checklist.md` appears to be the likely source-of-truth repair document.
- No prior `task_plan.md`, `findings.md`, or `progress.md` existed in the repo root.

## Source-of-Truth Checklist

- Confirmed `docs/remediation-checklist.md` is the only actionable remediation list in `docs/`; `docs/roadmap.md` is planning-only.

## First Execution Batch

- Start with checklist items 3, 6, 8, 11, plus the explicit quick win to remove `alert(...)` in `pdf-viewer.tsx`.
- Reasoning: this batch includes one P0 correctness fix and several isolated UI/PDF boundary fixes with lower coupling than storage locking or parse-boundary redesign.

## File Mapping Notes

- `src/components/resume-preview.tsx`: `formatJobIntention()` still performs in-place sort on `resumeData.jobIntentionSection.items`; `personalInfo` already uses copy-before-sort.
- `src-tauri/src/pdf.rs`: temporary HTML path is fixed to `print.html`; cleanup runs twice.
- `src/routes/EditResume.tsx` and `src/routes/ViewResume.tsx`: async load path sets `loading` false only on success and has no visible error state.
- `src/routes/EditNew.tsx`: prefetched session data uses `JSON.parse(...) as ResumeData`; clone load path lacks catch/cancel/error UI.
- `src/components/print-content.tsx`: still falls back to `sessionStorage.getItem('resumeData')`, which conflicts with the desktop-file storage contract.
- `src/components/pdf-viewer.tsx`: fallback notice is inline, but failure UX still includes `alert(...)` in the later download branch.
- `src/types/resume.ts`: still exports legacy `LOCAL_STORAGE_KEY` constant.

## Batch 2 Storage Notes

- `src-tauri/src/storage.rs`: before Batch 2, `write_storage` still used direct `fs::write(...)`, which risked partial/truncated `resumes.json` on interruption.
- `src-tauri/src/storage.rs`: `create_resume`, `create_resume_from_data`, `update_resume`, and `delete_resumes` all used unlocked read-modify-write flows and could lose updates under concurrent invocation.
- `src-tauri/src/lib.rs`: no managed Rust-side storage lock existed before Batch 2; Tauri setup only ensured the app data directory existed.
- `src-tauri/src/applications.rs` and `src-tauri/src/ai_config.rs` still use direct JSON writes too, but those broader infrastructure follow-ups remain part of checklist item 16, not this batch.

## Batch 2 Implementation Outcome

- Added `ResumeStorageLock` in `src-tauri/src/storage.rs` and managed it from `src-tauri/src/lib.rs` so mutating resume-storage commands are serialized through Tauri state.
- Refactored storage IO in `src-tauri/src/storage.rs` into path-based helpers and changed writes to temp-file + flush + `sync_all` + rename replacement using unique same-directory temp filenames.
- Added Rust tests covering both new acceptance targets:
  - atomic replacement without leftover temp artifacts
  - concurrent mutation serialization without lost entries

## Batch 2 Verification

- `cargo test --manifest-path src-tauri/Cargo.toml atomic_storage_write_replaces_existing_file_without_temp_artifacts` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml serializes_concurrent_storage_mutations_without_losing_entries` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed with 12 tests.
- `pnpm build` passed; only pre-existing Vite chunk/dynamic-import warnings remained.
- Rust LSP diagnostics could not run because `rust-analyzer` is unavailable in the environment, so Rust verification relied on compile/test execution instead.

## Existing Pattern References

- Toast/error style: `src/components/export-button.tsx`, `src/hooks/use-toast.ts`, and `src/components/user-center.tsx` use destructive toasts for recoverable failures.
- Route async load/error handling: `src/components/application-board.tsx` shows the repo pattern for visible async failure states, while `src/components/icon-picker.tsx` demonstrates a simple cancellation guard inside `useEffect`.

## Batch 1 Implementation Completed

- `src/components/resume-preview.tsx`: added copy-before-sort for job intention items, modules, and rows to avoid render-time mutation.
- `src-tauri/src/pdf.rs`: temp HTML files now use unique names and are cleaned up exactly once through a single shared cleanup path.
- `src-tauri/src/pdf.rs`: additionally hardens `write_temp_html()` to remove the temp path if `fs::write` itself fails before returning.
- `src/components/print-content.tsx`: removed stale `sessionStorage('resumeData')` fallback and now relies on explicit `initialData` only.
- `src/types/resume.ts`: removed unused legacy `LOCAL_STORAGE_KEY` export.
- `src/components/pdf-viewer.tsx`: replaced `alert(...)` failure path with the existing destructive toast pattern.
- `src/routes/EditResume.tsx`, `src/routes/EditNew.tsx`, `src/routes/ViewResume.tsx`: added cancellation-guarded async loads, destructive toasts on load failure, visible inline error states, and retry actions; `EditNew` also now surfaces clone-not-found separately.

## Verification Notes

- `pnpm build` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed (10 tests).
- Repo-wide grep confirmed there are no remaining `LOCAL_STORAGE_KEY` references and no remaining `sessionStorage('resumeData')` usage.
