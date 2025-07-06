// This file is intentionally modified to resolve a Next.js build conflict.
// By exporting an empty object, it's treated as a module but not a page component,
// which prevents the "parallel routes" error.
// The correct page is located at: src/app/(app)/admin/users/page.tsx
export {};
