// This file is intentionally modified to resolve a Next.js build conflict.
// By exporting only a named constant and no default component, we ensure
// Next.js does not treat this as a page, resolving the parallel route error.
export const message = "This is not a page component.";
