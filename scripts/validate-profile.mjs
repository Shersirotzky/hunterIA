import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const profileSchema = z.object({
  identity: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().optional(),
  experience: z.array(z.record(z.string(), z.unknown())),
  education: z.array(z.record(z.string(), z.unknown())),
  certifications: z.array(z.record(z.string(), z.unknown())),
  skills: z.object({ listed: z.array(z.string()) }).passthrough(),
  languages: z.record(z.string(), z.unknown()),
  jobPreferences: z.record(z.string(), z.unknown()),
  unknowns: z.array(z.string()),
});

const file = process.argv[2] ?? "private/linkedin-export-2026-11-18/perfil-profissional.json";
const raw = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
const profile = profileSchema.parse(raw);

console.log(JSON.stringify({
  valid: true,
  experience: profile.experience.length,
  education: profile.education.length,
  certifications: profile.certifications.length,
  listedSkills: profile.skills.listed.length,
  unknownFields: profile.unknowns.length,
  source: "private-local-only",
}));
