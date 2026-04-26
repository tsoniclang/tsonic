---
title: .NET Interop
---

# Dotnet Interop

This page is a compatibility entry point for “dotnet interop” links.

The material lives here:

- [CLR Bindings and Interop](dotnet-bindings.md)
- [Bindings](bindings.md)

## Short version

- import CLR APIs explicitly from generated binding packages
- use `tsbindgen`-generated packages for CLR frameworks and libraries
- keep first-party source packages separate from generated CLR bindings

## Typical imports

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { WebApplication } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";
```

Use [CLR Bindings and Interop](dotnet-bindings.md) when you want the detailed
package and workflow view.
