import type { int } from "@tsonic/core/types.js";
import { BlogDbContext } from "./db.js";

export function run(postId: int): void {
  const db = new BlogDbContext();
  const post = db.posts.Find(postId);
  if (post !== undefined) {
    db.Remove(post);
  }
}
