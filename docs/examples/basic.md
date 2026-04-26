---
title: Basic Examples
---

# Basic Examples

## Default CLR surface

Setup:

```bash
tsonic init
tsonic run
```

Code:

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from CLR");
}
```

## JS surface

Setup:

```bash
tsonic init --surface @tsonic/js
tsonic run
```

Code:

```ts
export function main(): void {
  const name = "  tsonic  ".trim().toUpperCase();
  console.log(name);
}
```

## JS surface + Node package

Setup:

```bash
tsonic init --surface @tsonic/js
tsonic add npm @tsonic/nodejs
tsonic run
```

Code:

```ts
import * as fs from "node:fs";
import * as path from "node:path";

export function main(): void {
  const file = path.join("src", "App.ts");
  console.log(fs.existsSync(file));
}
```

## Source package consumption

This is the first-party package model generalized to your own packages:

```ts
import { clamp } from "@acme/math";

export function main(): void {
  console.log(clamp(10, 0, 5).toString());
}
```

That works when `@acme/math` is a Tsonic source package with a compatible
`tsonic.package.json` manifest.
