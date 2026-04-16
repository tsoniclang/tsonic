# Getting Started

## Requirements

- Node.js 22+
- .NET 10 SDK

## Install

```bash
npm install -g tsonic
```

## Create a default CLR workspace

```bash
mkdir hello-clr
cd hello-clr
tsonic init
tsonic run
```

Generated sample:

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from Tsonic.");
}
```

This is the simplest possible CLR-first workspace:

- default surface is `clr`
- CLR APIs are imported explicitly
- the default generated project is an executable

## Create a JS workspace

```bash
mkdir hello-js
cd hello-js
tsonic init --surface @tsonic/js
tsonic run
```

```ts
export function main(): void {
  const value = JSON.parse<{ x: number }>('{"x": 1}');
  console.log(JSON.stringify(value));
}
```

This switches the workspace ambient world to `@tsonic/js`.

## Add Node modules

```bash
tsonic add npm @tsonic/nodejs
```

```ts
import * as fs from "node:fs";
import * as path from "node:path";

export function main(): void {
  const file = path.join("src", "App.ts");
  console.log(file, fs.existsSync(file));
}
```

This is the current package model in action:

- ambient world from `@tsonic/js`
- Node-style modules from `@tsonic/nodejs`

## Add CLR packages

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic restore
```

Then import the generated binding package:

```ts
import { ILogger_1 } from "@tsonic/microsoft-extensions/Microsoft.Extensions.Logging.js";
```

## First-party source packages

`tsonic init` now produces source-package-ready projects by default. Each
project gets a `tsonic.package.json` manifest.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "source": {
    "exports": {
      ".": "./src/App.ts",
      "./index.js": "./src/App.ts"
    }
  }
}
```

Installed source packages with that manifest are compiled transitively as part
of the same Tsonic program.

## What to read next

- [CLI Workflow](cli.md)
- [Surfaces and Packages](surfaces-and-packages.md)
- [Workspace and Project Files](workspace-and-projects.md)
