import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CATALOG } from "./catalog";

const migration = fs.readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261014090000_catalog_exercises.sql"), "utf8");
const dataset = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../docs/research/exercise_technique_dataset.json"), "utf8"));

describe("catalog stays in sync", () => {
  it("every exercise and error code is in the database migration", () => {
    for (const d of CATALOG) {
      expect(migration, d.id).toContain(`('${d.id}', '${d.name.replace(/'/g, "''")}'`);
      for (const c of d.checks) expect(migration, `${d.id}.${c.code}`).toContain(`('${d.id}', '${c.code}'`);
    }
  });
  it("every check cites checkpoints that exist in the dataset for that exercise", () => {
    for (const d of CATALOG) {
      const ex = dataset.exercises.find((e: { id: string }) => e.id === d.datasetId);
      expect(ex, d.id).toBeTruthy();
      const ids = new Set(ex.checkpoints.map((c: { id: string }) => c.id));
      for (const c of d.checks) for (const cp of c.source.checkpoints) expect(ids.has(cp), `${d.id}.${c.code} → ${cp}`).toBe(true);
    }
  });
});
