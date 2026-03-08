# Basic Examples

## Default CLR Surface

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from CLR");
}
```

## JS Surface

```ts
export function main(): void {
  const name = "  tsonic  ".trim().toUpperCase();
  console.log(name);
}
```

## JS Surface + Node Package

```ts
import * as fs from "node:fs";
import * as path from "node:path";

export function main(): void {
  const file = path.join("src", "App.ts");
  console.log(fs.existsSync(file));
}
```

## Source Package Consumption

```ts
import { clamp } from "@acme/math";

export function main(): void {
  console.log(clamp(10, 0, 5).toString());
}
```
