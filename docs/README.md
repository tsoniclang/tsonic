---
title: Tsonic
---

# Tsonic Compiler Guide

Tsonic compiles a strict, deterministic subset of TypeScript into C#, then
hands that generated project to the .NET toolchain for build, publish, test, or
pack.

## Use this section for

- how the CLI actually works
- how workspaces, projects, and package manifests fit together
- how surfaces differ from packages
- how first-party source packages differ from generated CLR binding packages
- how generated output is structured
- what the architecture guarantees and rejects

## Model

The V1 model is:

- one compiler-owned noLib baseline
- one active ambient surface per workspace
- explicit package-based CLR and module interop
- deterministic lowering only; unsupported dynamic cases are rejected
- source-package graphs compiled as part of the same Tsonic program

## Read in this order

- [Getting Started](getting-started.md)
- [CLI Workflow](cli.md)
- [Surfaces and Packages](surfaces-and-packages.md)
- [Workspace and Project Files](workspace-and-projects.md)
- [Build Modes](build-modes.md)
- [Build Output](build-output.md)
- [Bindings](bindings.md)
- [CLR Bindings and Interop](dotnet-bindings.md)
- [Type System Rules](type-system.md)
- [Diagnostics](diagnostics.md)
- [Testing and Quality Bar](testing-and-quality.md)
- [Examples](examples/)
- [Architecture Section](architecture/)

## Practical rule of thumb

- use `clr` when you want a CLR-first ambient world
- use `@tsonic/js` when you want a JS ambient world
- add `@tsonic/nodejs` when you want Node-style modules
- add generated binding packages when you need CLR libraries beyond the baseline

## What this guide does not do

This section is not a copy of repo-internal design notes. It explains the
public model for users and downstream application authors.
