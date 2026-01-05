import { Console } from "@tsonic/dotnet/System.js";
import { DbContextOptionsBuilder } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import { SqliteDbContextOptionsBuilderExtensions } from "@tsonic/efcore-sqlite/Microsoft.EntityFrameworkCore.js";

export function main(): void {
  Console.writeLine("=== EF Core E2E ===");

  const builder = new DbContextOptionsBuilder();
  SqliteDbContextOptionsBuilderExtensions.useSqlite(
    builder,
    "Data Source=:memory:"
  );

  Console.writeLine(`Configured: ${builder.isConfigured}`);
}
