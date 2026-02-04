import { int } from "@tsonic/core/types.js";
import { asinterface } from "@tsonic/core/lang.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";
import type { IQueryable } from "@tsonic/dotnet/System.Linq.js";
import { DbContext, DbContextOptionsBuilder, DbSet } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import type { DbContextOptions } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
import type { IDesignTimeDbContextFactory } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.Design.js";
import { SqliteDbContextOptionsBuilderExtensions } from "@tsonic/efcore-sqlite/Microsoft.EntityFrameworkCore.js";

type LinqQ<T> = Linq<IQueryable<T>>;

export class EventEntity {
  Id: int = 0;
  CampaignId: string = "";
}

export class AppDbContext extends DbContext {
  get Events(): DbSet<EventEntity> {
    return this.Set<EventEntity>();
  }

  constructor(options: DbContextOptions) {
    super(options);
  }
}

export const createDbOptions = (): DbContextOptions => {
  const optionsBuilder = new DbContextOptionsBuilder();
  SqliteDbContextOptionsBuilderExtensions.UseSqlite(optionsBuilder, "Data Source=:memory:");
  return optionsBuilder.Options;
};

export class AppDbContextFactory
  implements IDesignTimeDbContextFactory<AppDbContext>
{
  CreateDbContext(_args: string[]): AppDbContext {
    return new AppDbContext(createDbOptions());
  }
}

export function countEventsByCampaign(db: AppDbContext, campaignId: string): int {
  const q = asinterface<LinqQ<EventEntity>>(db.Events);
  return q.Where((e) => e.CampaignId === campaignId).Count();
}

export function countEventsWithOptionalFilter(db: AppDbContext, campaignId?: string): int {
  const hasCampaign = campaignId !== undefined && campaignId !== "";
  const q = asinterface<LinqQ<EventEntity>>(db.Events);
  return q.Where((e) => !hasCampaign || e.CampaignId === campaignId).Count();
}

export function main(): void {
  // This fixture's purpose is post-build validation (dotnet-ef precompile).
}
