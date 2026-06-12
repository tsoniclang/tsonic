import type { GoError } from "../compat.js";

export class URL {
  constructor(private readonly value: globalThis.URL) {}

  String(): string {
    return this.value.toString();
  }

  Path(): string {
    return this.value.pathname;
  }

  RawQuery(): string {
    return this.value.search.length > 0 ? this.value.search.slice(1) : "";
  }
}

export function Parse(rawURL: string): [URL | undefined, GoError] {
  try {
    return [new URL(new globalThis.URL(rawURL)), undefined];
  } catch (absoluteError) {
    try {
      return [new URL(new globalThis.URL(rawURL, "file:///")), undefined];
    } catch {
      return [undefined, absoluteError instanceof globalThis.Error ? absoluteError : new globalThis.Error(String(absoluteError))];
    }
  }
}

export function PathEscape(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
}

export function QueryEscape(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, "+");
}

export function QueryUnescape(s: string): [string, GoError] {
  try {
    return [decodeURIComponent(s.replace(/\+/g, " ")), undefined];
  } catch (error) {
    return ["", error instanceof globalThis.Error ? error : new globalThis.Error(String(error))];
  }
}
