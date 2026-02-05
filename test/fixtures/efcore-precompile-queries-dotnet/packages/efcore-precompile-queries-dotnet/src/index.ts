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
  // NOTE: EF query precompilation (NativeAOT) currently requires locals (not parameter
  // symbols) for values referenced inside query expressions.
  const db0 = db;
  const campaignId0 = campaignId;

  return asinterface<LinqQ<EventEntity>>(db0.Events)
    .Where((e) => e.CampaignId === campaignId0)
    .Count();
}

export const countEventsByCampaignConst = (db: AppDbContext, campaignId: string): int => {
  const db0 = db;
  const campaignId0 = campaignId;

  return asinterface<LinqQ<EventEntity>>(db0.Events)
    .Where((e) => e.CampaignId === campaignId0)
    .Count();
};

export function countEventsWithOptionalFilter(db: AppDbContext, campaignId?: string): int {
  const db0 = db;
  const campaignId0 = campaignId;
  const hasCampaign = campaignId0 !== undefined && campaignId0 !== "";

  return asinterface<LinqQ<EventEntity>>(db0.Events)
    .Where((e) => !hasCampaign || e.CampaignId === campaignId0)
    .Count();
}

export function main(): void {
  // This fixture's purpose is post-build validation (dotnet-ef precompile).
}
