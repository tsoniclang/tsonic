declare global {
  interface ImportMeta {
    readonly url: string;
    readonly filename: string;
    readonly dirname: string;
  }
}

export function main(): void {
  const meta = import.meta;
  console.log(
    meta.url.startsWith("file://") &&
      meta.filename.length > 0 &&
      meta.dirname.length > 0
  );
}
