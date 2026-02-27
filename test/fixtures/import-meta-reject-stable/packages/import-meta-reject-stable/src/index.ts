declare global {
  interface ImportMeta {
    readonly url: string;
    readonly filename: string;
    readonly dirname: string;
  }
}

const meta = import.meta.env;
console.log(meta);
