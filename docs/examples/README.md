---
title: Examples
---

# Examples

These examples reflect the source-first package model and the way the
ecosystem is actually exercised in `proof-is-in-the-pudding`.

## Pages

- [Basic Examples](basic.md)
- [Arrays and Collections](arrays.md)
- [Import Patterns](imports.md)
- [CLR / .NET Examples](dotnet.md)
- [Workspace Package Graphs](workspace-packages.md)

## What these examples assume

- `clr` or `@tsonic/js` is selected explicitly at the workspace level
- `@tsonic/nodejs` is added when Node-style modules are needed
- generated CLR binding packages are imported explicitly
- package graphs are deterministic and closed-world

## Real example repos

When you want larger examples, look at:

- `proof-is-in-the-pudding/bcl`
- `proof-is-in-the-pudding/js`
- `proof-is-in-the-pudding/nodejs`
- `proof-is-in-the-pudding/aspnetcore`
- `proof-is-in-the-pudding` workspace overlays and verify scripts

Those are not toy snippets; they are part of the downstream verification bar.
