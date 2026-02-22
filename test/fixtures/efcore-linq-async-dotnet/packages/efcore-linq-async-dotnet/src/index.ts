import { asinterface } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";
import {
  DbContext,
  DbSet,
} from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import type {
  DbContextOptions,
  ExtensionMethods as Ef,
} from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";

type DbSetQuery<T> = Ef<Linq<DbSet<T>>>;

export class UserEntity {
  Id: int = 0;
  TenantId: string = "";
  Email: string = "";
}

export class AppDbContext extends DbContext {
  get Users(): DbSet<UserEntity> {
    return this.Set<UserEntity>();
  }

  constructor(options: DbContextOptions) {
    super(options);
  }
}

export async function queryByTenantAndEmail(
  db: AppDbContext,
  tenantId: string,
  email: string
): Promise<UserEntity[]> {
  const db0 = db;
  const tenantId0 = tenantId;
  const email0 = email;

  return await asinterface<DbSetQuery<UserEntity>>(db0.Users)
    .Where((u) => u.TenantId === tenantId0 && u.Email === email0)
    .ToArrayAsync();
}

export function main(): void {
  // This fixture's purpose is typecheck coverage for EF async + LINQ extension chaining.
  Console.WriteLine("=== EF Core LINQ Async E2E ===");
}
