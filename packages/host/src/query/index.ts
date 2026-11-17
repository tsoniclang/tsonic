import type { CreateDatabase } from "./contract.js";
import { createQueryDatabase } from "./database.js";

export const createDatabase: CreateDatabase = createQueryDatabase;
