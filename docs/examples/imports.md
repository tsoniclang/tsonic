# Import Examples

## Local Relative Import

```ts
import { add } from "./math.js";
```

## CLR Import

```ts
import { Console } from "@tsonic/dotnet/System.js";
```

## Node Module Import

```ts
import * as fs from "node:fs";
import * as path from "node:path";
```

Requires:

- workspace surface `@tsonic/js`
- installed package `@tsonic/nodejs`

## Source Package Import

```ts
import { clamp } from "@acme/math";
```

Works when `@acme/math` is a Tsonic source package with a compatible manifest.

## Dynamic Import

Supported deterministic forms:

```ts
const mod = await import("./module.js");
await import("./side-effect.js");
```

Rejected:

```ts
await import(specifier);
```
