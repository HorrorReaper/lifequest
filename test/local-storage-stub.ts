// Node 22+'s experimental global `localStorage` shadows jsdom's real
// implementation in this project's Vitest setup (throws/undefined without
// --localstorage-file), so window.localStorage is unusable as-is. A minimal
// in-memory stand-in keeps component tests self-contained rather than
// changing shared Vitest config.
export function installLocalStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}
