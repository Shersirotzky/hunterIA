/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as identity from "../identity.js";
import type * as jobDomain from "../jobDomain.js";
import type * as jobs from "../jobs.js";
import type * as lib_authz from "../lib/authz.js";
import type * as linkedinPolicy from "../linkedinPolicy.js";
import type * as migration from "../migration.js";
import type * as operations from "../operations.js";
import type * as profile from "../profile.js";
import type * as profileDomain from "../profileDomain.js";
import type * as resumes from "../resumes.js";
import type * as resumesData from "../resumesData.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  identity: typeof identity;
  jobDomain: typeof jobDomain;
  jobs: typeof jobs;
  "lib/authz": typeof lib_authz;
  linkedinPolicy: typeof linkedinPolicy;
  migration: typeof migration;
  operations: typeof operations;
  profile: typeof profile;
  profileDomain: typeof profileDomain;
  resumes: typeof resumes;
  resumesData: typeof resumesData;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
