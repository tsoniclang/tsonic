import type { int } from "@tsonic/core/types.js";
import type {
  DbContext,
  DbSet_1,
  EntityEntry_1,
} from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";

export interface PostEntity {
  Id: int;
}

export class BlogDbContext implements DbContext {
  __tsonic_type_Microsoft_EntityFrameworkCore_DbContext!: never;
  posts!: DbSet_1<PostEntity>;
  Remove<TEntity>(entity: TEntity): EntityEntry_1<TEntity> {
    throw new Error("not reached");
  }
}
