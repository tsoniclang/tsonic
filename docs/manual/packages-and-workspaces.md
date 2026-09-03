# Packages and workspaces

Tsonic uses normal npm packages and ESM package exports. A package can contain
authored TypeScript and be compiled as part of a consuming program.

## Create a source package

```text
packages/domain/
├── package.json
└── src/
    ├── index.ts
    └── user.ts
```

`packages/domain/package.json`:

```json
{
  "name": "@acme/domain",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./index.js": "./src/index.ts",
    "./package.json": "./package.json"
  }
}
```

`packages/domain/src/index.ts`:

```ts
export { User } from "./user.js";
```

`packages/domain/src/user.ts`:

```ts
export class User {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}
```

The export key uses `.js` because consumers author ESM imports. The export
target points to the real `.ts` source file.

## Consume the package

```json
{
  "name": "@acme/app",
  "private": true,
  "type": "module",
  "dependencies": {
    "@acme/domain": "workspace:*"
  },
  "devDependencies": {
    "@tsonic/cli": "^0.1.0",
    "@tsonic/target-rust": "^0.1.0"
  }
}
```

```ts
import { User } from "@acme/domain/index.js";

export function main(): void {
  const user = new User("42", "Ada");
  if (user.name !== "Ada") {
    throw new Error("unexpected user");
  }
}
```

Tsonic follows the installed package export to its TypeScript source. It does
not require generated declaration packages or a separate binding generator.

## Create a workspace

At the repository root:

```json
{
  "name": "acme-workspace",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm -ws --if-present run build"
  }
}
```

Run `npm install` at the workspace root. npm installs and links the source
packages. Each independently compiled package keeps its own `tsonic.json` and
build script.

## Package rules

- Use ESM imports and exports only.
- Use `.js` in authored relative and package-subpath imports.
- Export concrete `.ts` or `.mts` source files.
- Declare every consumed package in `dependencies` or `devDependencies`.
- Do not use `paths`, `baseUrl`, ambient module shims, or package-name fallbacks.
- A package must be valid under every target and source surface that consumes
  it.

Tsonic follows only the checked package graph. An unimported source file is not
compiled merely because it exists under `src`.

## Target-specific packages

A source package may intentionally expose target-native contracts. Make that
ownership visible in the package name and imports:

```ts
// C#-specific package
import type { int } from "@tsonic/csharp/types.js";

// Rust-specific package
import type { Ref } from "@tsonic/rust/types.js";
```

Keep portable packages on ordinary TypeScript and `@tsonic/core` contracts.
Do not hide target-native imports behind a supposedly portable barrel.
