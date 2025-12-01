# Examples

Learn Tsonic through practical examples.

## Available Examples

### [Basic Programs](basic.md)

- Hello World
- Variables and functions
- Classes and interfaces
- Control flow

### [Arrays](arrays.md)

- Array creation and manipulation
- Array methods (push, pop, slice, map)
- Working with List<T>

### [.NET Integration](dotnet.md)

- File I/O with System.IO
- JSON with System.Text.Json
- HTTP with System.Net.Http
- Working with .NET types

### [Module Imports](imports.md)

- Local module imports
- .NET namespace imports
- Cross-directory imports
- Organizing larger projects

## Running Examples

Each example shows TypeScript input and how to compile it:

```bash
# Save the TypeScript code to a file
cat > example.ts << 'EXEOF'
export function main() {
  console.log("Hello!");
}
EXEOF

# Compile and run
tsonic build example.ts
./example
```

## Example Structure

Each example includes:

1. **TypeScript source** - The input code
2. **Command** - How to compile it
3. **Output** - What you'll see when running
4. **Explanation** - What's happening
5. **Try it** - Variations to experiment with

## Next Steps

After exploring examples:

- Read the [Language Reference](../language/module-system.md)
- Check [Type Mappings](../language/type-mappings.md)
- Learn [.NET Interop](../language/dotnet-interop.md)
