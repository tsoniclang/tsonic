declare module "node:fs" {
  export const readFileSync: (path: string) => string;
}

declare module "node:http" {
  export const http: unknown;
}

import fs from "node:fs";
import { http } from "node:http";

export const badNodeImports = fs;
void http;
