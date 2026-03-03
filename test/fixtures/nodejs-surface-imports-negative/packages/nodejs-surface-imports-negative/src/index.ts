declare module "node:fs" {
  export const readFileSync: (path: string) => string;
}

declare module "node:http" {
  export const http: unknown;
}

import { readFileSync } from "node:fs";
import { http } from "node:http";

export const badNodeImports = readFileSync;
void http;
