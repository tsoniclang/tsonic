import type {
  BindRoles, BindSummaries, LibraryRoleOf, LibraryRolesOf, VerifyAuthoredSummaries,
  VerifyBoundLibraries, VerifyLibraries, VerifyLibraryCatalogue,
} from "./contract.js";
import { bindCatalogueRoles, roleOf, rolesOf } from "./roles.js";
import { bindDeclaredSummaries } from "./bind-summaries.js";
import { checkLibraryCatalogue } from "./verify-catalogue.js";
import { checkAuthoredSummaries } from "./verify-summaries.js";
import { checkBoundLibraries, checkLibraries } from "./verify-bound.js";

export const bindRoles: BindRoles = bindCatalogueRoles;
export const bindSummaries: BindSummaries = bindDeclaredSummaries;
export const libraryRolesOf: LibraryRolesOf = rolesOf;
export const libraryRoleOf: LibraryRoleOf = roleOf;
export const verifyLibraryCatalogue: VerifyLibraryCatalogue = checkLibraryCatalogue;
export const verifyAuthoredSummaries: VerifyAuthoredSummaries = checkAuthoredSummaries;
export const verifyBoundLibraries: VerifyBoundLibraries = checkBoundLibraries;
export const verifyLibraries: VerifyLibraries = checkLibraries;
