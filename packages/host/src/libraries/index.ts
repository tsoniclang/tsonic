import type {
  BindRoles, AdmitGuarantees, LibraryExportKey, LibraryRoleOf, LibraryRolesOf, VerifyAuthoredSummaries,
  VerifyBoundLibraries, VerifyLibraries, VerifyLibraryCatalogue,
} from "./contract.js";
import { bindCatalogueRoles, roleOf, rolesOf } from "./roles.js";
import { admitGuarantees as admit } from "./admit-guarantees.js";
import { checkLibraryCatalogue, exportKey } from "./verify-catalogue.js";
import { checkAuthoredSummaries } from "./verify-summaries.js";
import { checkBoundLibraries, checkLibraries } from "./verify-bound.js";

export const bindRoles: BindRoles = bindCatalogueRoles;
export const admitGuarantees: AdmitGuarantees = admit;
export const libraryExportKey: LibraryExportKey = exportKey;
export const libraryRolesOf: LibraryRolesOf = rolesOf;
export const libraryRoleOf: LibraryRoleOf = roleOf;
export const verifyLibraryCatalogue: VerifyLibraryCatalogue = checkLibraryCatalogue;
export const verifyAuthoredSummaries: VerifyAuthoredSummaries = checkAuthoredSummaries;
export const verifyBoundLibraries: VerifyBoundLibraries = checkBoundLibraries;
export const verifyLibraries: VerifyLibraries = checkLibraries;
