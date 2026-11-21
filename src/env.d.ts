declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  const factory: (options?: { onRuntimeInitialized?: () => void }) => unknown;
  export default factory;
}
