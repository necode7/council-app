/**
 * Seed Script: Insert domain-specific advisor templates into Supabase.
 *
 * Usage:
 *   npx tsx --env-file .env.local src/scripts/seed-templates.ts
 *
 * Requires these env vars (set in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← needed to bypass RLS for system templates
 *
 * Safe to re-run — skips templates whose slug already exists.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local if env vars aren't already set
function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found — rely on existing env vars
  }
}

loadEnvFile();
import { SEED_TEMPLATES } from '../lib/council/templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function seed() {
  console.log(`Seeding ${SEED_TEMPLATES.length} templates...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const template of SEED_TEMPLATES) {
    const { data: existing } = await supabase
      .from('templates')
      .select('id')
      .eq('slug', template.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP  ${template.slug} (already exists)`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('templates').insert({
      name: template.name,
      slug: template.slug,
      description: template.description,
      category: template.category,
      intake_schema: template.intake_schema,
      advisor_panel: template.advisor_panel,
      chairman_prompt: null,
      user_id: null,
      is_public: true,
    });

    if (error) {
      console.error(`  FAIL  ${template.slug}: ${error.message}`);
    } else {
      console.log(`  OK    ${template.slug}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
