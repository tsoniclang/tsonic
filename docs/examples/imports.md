---
title: Import Patterns
---

# Import Patterns

## ESM rule first

Tsonic follows ESM-style import specifiers. Use explicit `.js` subpaths where
appropriate.

## Local relative import

```ts
import { add } from "./math.js";
```

## CLR import

```ts
import { Console } from "@tsonic/dotnet/System.js";
```

## Node module import

```ts
import * as fs from "node:fs";
import * as path from "node:path";
```

Requires:

- workspace surface `@tsonic/js`
- installed package `@tsonic/nodejs`

## Source package import

```ts
import { clamp } from "@acme/math";
```

Works when `@acme/math` is a Tsonic source package with a compatible
`tsonic.package.json` manifest.

## Package-root import

You can still import a source package explicitly by subpath:

```ts
import { fs, path } from "@tsonic/nodejs/index.js";
import { Date } from "@tsonic/js/index.js";
```

## Dynamic import

Supported deterministic forms:

```ts
const mod = await import("./module.js");
await import("./side-effect.js");
```

Rejected:

```ts
await import(specifier);
await import("some-package");
```

The rule is simple: the import graph must stay closed-world and resolvable at
compile time.
