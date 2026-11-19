import { internalMutation } from "./_generated/server";
import { components } from "./_generated/api";

// Resolve only session owners attested by the original auth component.
// Unknown or expired sessions remain untouched; never assign founder data to a new user.
export const migrateSessionOwners = internalMutation({ args: {}, handler: async ctx => {
  const tables = ["professionalProfiles", "documents", "jobSources", "automationRuns", "platformAuthorizations", "externalConnections", "ownerSettings", "jobs", "jobMatches", "applications", "auditLogs"] as const;
  let migrated = 0;
  let unresolved = 0;
  for (const table of tables) {
    for (const row of await ctx.db.query(table).take(500)) {
      if (row.ownerUserId.startsWith("oauth:")) continue;
      const userId = ctx.db.normalizeId("users", row.ownerUserId);
      if (userId && await ctx.db.get(userId)) continue;
      try {
        const session = await ctx.runQuery(components.auth.public.getSession, { sessionId: row.ownerUserId });
        if (!session) { unresolved++; continue; }
        await ctx.db.patch(row._id, { ownerUserId: session.userId });
        migrated++;
      } catch { unresolved++; }
    }
  }
  return { migrated, unresolved };
} });
