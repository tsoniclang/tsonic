# Validation Contract

## Purpose

Define validation rules enforced before IR building.

## Validation Passes

### 1. ESM Rules (TSN1xxx)

- **TSN1001** - Local import missing `.ts` extension
- **TSN1002** - Import has wrong extension
- **TSN1003** - Import case doesn't match file case
- **TSN1004** - Node.js built-in modules not supported
- **TSN1005** - JSON imports not supported
- **TSN1006** - Circular dependency detected

### 2. Type System (TSN2xxx)

- **TSN2001** - Literal types not supported
- **TSN2002** - Conditional types not supported
- **TSN2003** - Mapped types not supported
- **TSN2004** - String enums not supported

### 3. Unsupported Features (TSN3xxx)

- **TSN3001** - Export-all not supported
- **TSN3002** - Default exports not supported
- **TSN3003** - Dynamic imports not supported
- **TSN3004** - Union types not supported (MVP)

### 4. Code Generation (TSN4xxx)

Reserved for emitter-phase errors.

### 5. Build Errors (TSN5xxx)

Reserved for backend/NativeAOT errors.

### 6. Configuration (TSN6xxx)

Reserved for tsonic.json validation errors.

## Diagnostic Format

```typescript
type Diagnostic = {
  code: string;        // e.g., "TSN1001"
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
  column?: number;
};
```

## Implementation

Location: `packages/frontend/src/validation/`

## See Also

- [docs/diagnostics.md](../docs/diagnostics.md) - User-facing error guide
- [architecture/04-phase-validation.md](architecture/04-phase-validation.md)
