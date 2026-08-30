// Next.js aliases the `server-only` import internally at build time; it is not
// an installed package, so anything importing it cannot be resolved under
// Vitest. This stub stands in for it so server-side modules stay unit-testable.
export {}
