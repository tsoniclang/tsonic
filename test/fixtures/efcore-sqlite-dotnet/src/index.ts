import { Console } from "@tsonic/dotnet/System.js";
import { SqliteDbContextOptionsBuilderExtensions } from "@tsonic/efcore-sqlite/Microsoft.EntityFrameworkCore.js";

// NOTE: The efcore facade currently exports `DbContextOptionsBuilder` as a type alias
// but does not export the constructor value. For this E2E test we import the value
// from the generated internal module while still importing the namespace facade for
// CLR discovery.
import "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import { DbContextOptionsBuilder } from "@tsonic/efcore/Microsoft.EntityFrameworkCore/internal/index.js";

export function main(): void {
  Console.writeLine("=== EF Core E2E ===");

  const builder = new DbContextOptionsBuilder();
  SqliteDbContextOptionsBuilderExtensions.useSqlite(
    builder,
    "Data Source=:memory:"
  );

  Console.writeLine(`Configured: ${builder.isConfigured}`);
}

