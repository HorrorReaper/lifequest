import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE_REPOSITORY = 'hasaneyldrm/exercises-dataset'
const SOURCE_COMMIT = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const SOURCE_SHA256 = '656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d'
const EXPECTED_RECORDS = 1324
const CATALOG_SOURCE = 'hasaneyldrm/exercises-dataset'
const SOURCE_URL = `https://github.com/${SOURCE_REPOSITORY}/tree/${SOURCE_COMMIT}`
const LICENSE_URL = `https://github.com/${SOURCE_REPOSITORY}/blob/${SOURCE_COMMIT}/LICENSE`
const ATTRIBUTION = 'Exercise metadata and instructions © 2026 Hasan Emir Yıldırım · MIT License'
const DOLLAR_TAG = 'exercise_dataset_7455efae'

const [sourceArgument, migrationArgument] = process.argv.slice(2)

if (!sourceArgument || !migrationArgument) {
  console.error('Usage: node scripts/generate-exercise-dataset-migration.mjs <exercises.json> <migration.sql>')
  process.exit(1)
}

const sourcePath = resolve(sourceArgument)
const migrationPath = resolve(migrationArgument)
const rawSource = readFileSync(sourcePath, 'utf8')
const sourceHash = createHash('sha256').update(rawSource).digest('hex')

if (sourceHash !== SOURCE_SHA256) {
  throw new Error(`Dataset checksum mismatch. Expected ${SOURCE_SHA256}, received ${sourceHash}.`)
}

const sourceRows = JSON.parse(rawSource)

if (!Array.isArray(sourceRows) || sourceRows.length !== EXPECTED_RECORDS) {
  throw new Error(`Expected ${EXPECTED_RECORDS} exercise records, received ${sourceRows.length}.`)
}

const ids = new Set()

for (const exercise of sourceRows) {
  if (!exercise.id || !exercise.name || !exercise.target || !exercise.equipment || !exercise.instructions?.en) {
    throw new Error(`Dataset record ${exercise.id ?? '(missing id)'} is missing required metadata.`)
  }
  if (ids.has(exercise.id)) throw new Error(`Duplicate dataset id: ${exercise.id}`)
  ids.add(exercise.id)
  slugify(exercise.name)
}

const usedSlugs = new Set()
const importedRows = sourceRows.map((exercise) => {
  const baseSlug = slugify(exercise.name)
  const slug = usedSlugs.has(baseSlug) ? `${baseSlug}-${exercise.id}` : baseSlug
  usedSlugs.add(slug)

  const instructions = Array.isArray(exercise.instruction_steps?.en) && exercise.instruction_steps.en.length
    ? exercise.instruction_steps.en.map(cleanText).filter(Boolean)
    : [cleanText(exercise.instructions.en)].filter(Boolean)
  const secondaryMuscles = uniqueStrings([
    ...(Array.isArray(exercise.secondary_muscles) ? exercise.secondary_muscles : []),
    exercise.muscle_group,
  ]).filter((muscle) => muscle !== cleanText(exercise.target).toLowerCase())

  return {
    external_id: String(exercise.id),
    name: titleCaseExercise(exercise.name),
    slug,
    muscle_group: cleanText(exercise.target).toLowerCase(),
    target_muscle: cleanText(exercise.target).toLowerCase(),
    secondary_muscles: secondaryMuscles,
    equipment: normalizeEquipment(exercise.equipment),
    tracking_type: inferTrackingType(exercise),
    instructions,
    aliases: uniqueStrings([
      exercise.name,
      exercise.category,
      exercise.body_part,
      exercise.target,
      exercise.muscle_group,
    ]),
  }
})

const payload = JSON.stringify(importedRows)

if (payload.includes(`$${DOLLAR_TAG}$`)) {
  throw new Error('Generated content unexpectedly contains the SQL dollar-quote delimiter.')
}

const migration = `-- Import ${EXPECTED_RECORDS} exercise metadata records from ${SOURCE_REPOSITORY}.
-- Source commit: ${SOURCE_COMMIT}
-- Source JSON SHA-256: ${SOURCE_SHA256}
-- Code, dataset structure, metadata and instruction text: MIT License.
-- Images and GIFs are excluded because they require a separate Gym Visual license.
-- License: ${LICENSE_URL}

alter table public.exercises
  add column if not exists catalog_source text,
  add column if not exists catalog_external_id text,
  add column if not exists target_muscle text,
  add column if not exists source_version text,
  add column if not exists source_url text,
  add column if not exists attribution text;

alter table public.exercises
  add constraint exercises_catalog_identity_check
  check (
    (catalog_source is null and catalog_external_id is null)
    or (catalog_source is not null and catalog_external_id is not null)
  ) not valid;

alter table public.exercises validate constraint exercises_catalog_identity_check;

create unique index if not exists exercises_catalog_external_id_idx
  on public.exercises (catalog_source, catalog_external_id)
  where catalog_source is not null and catalog_external_id is not null;

create index if not exists exercises_catalog_target_idx
  on public.exercises (target_muscle, equipment, name)
  where is_system and not is_archived;

with dataset_rows as (
  select
    row ->> 'external_id' as external_id,
    row ->> 'name' as name,
    row ->> 'slug' as slug,
    row ->> 'muscle_group' as muscle_group,
    row ->> 'target_muscle' as target_muscle,
    array(select jsonb_array_elements_text(row -> 'secondary_muscles')) as secondary_muscles,
    row ->> 'equipment' as equipment,
    row ->> 'tracking_type' as tracking_type,
    array(select jsonb_array_elements_text(row -> 'instructions')) as instructions,
    array(select jsonb_array_elements_text(row -> 'aliases')) as aliases
  from jsonb_array_elements(
    $${DOLLAR_TAG}$${payload}$${DOLLAR_TAG}$::jsonb
  ) as source(row)
)
insert into public.exercises (
  user_id,
  name,
  slug,
  muscle_group,
  target_muscle,
  secondary_muscles,
  equipment,
  tracking_type,
  instructions,
  aliases,
  is_system,
  source,
  catalog_source,
  catalog_external_id,
  source_version,
  source_url,
  attribution
)
select
  null,
  name,
  slug,
  muscle_group,
  target_muscle,
  secondary_muscles,
  equipment,
  tracking_type,
  instructions,
  aliases,
  true,
  'system',
  '${CATALOG_SOURCE}',
  external_id,
  '${SOURCE_COMMIT}',
  '${SOURCE_URL}',
  '${ATTRIBUTION}'
from dataset_rows
on conflict (slug) where is_system
do update set
  muscle_group = excluded.muscle_group,
  target_muscle = excluded.target_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  instructions = excluded.instructions,
  aliases = excluded.aliases,
  catalog_source = excluded.catalog_source,
  catalog_external_id = excluded.catalog_external_id,
  source_version = excluded.source_version,
  source_url = excluded.source_url,
  attribution = excluded.attribution,
  updated_at = now();

do $validation$
begin
  if (
    select count(*)
    from public.exercises
    where catalog_source = '${CATALOG_SOURCE}'
      and source_version = '${SOURCE_COMMIT}'
  ) <> ${EXPECTED_RECORDS} then
    raise exception 'Exercise dataset import did not produce exactly ${EXPECTED_RECORDS} catalog records';
  end if;
end;
$validation$;
`

writeFileSync(migrationPath, migration)
console.log(`Generated ${migrationPath} with ${importedRows.length} metadata-only exercise records.`)

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => cleanText(value).toLowerCase()).filter(Boolean))]
}

function normalizeEquipment(value) {
  const equipment = cleanText(value).toLowerCase()
  if (equipment === 'body weight') return 'bodyweight'
  return equipment
}

function slugify(value) {
  const slug = cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Error(`Cannot create a slug for exercise name: ${value}`)
  return slug
}

function titleCaseExercise(value) {
  return cleanText(value)
    .replace(/\b[a-z]/g, (character) => character.toUpperCase())
    .replace(/\bEz\b/g, 'EZ')
    .replace(/\bV\.(?=\s|\d|$)/g, 'v.')
}

function inferTrackingType(exercise) {
  const name = cleanText(exercise.name).toLowerCase()
  const equipment = cleanText(exercise.equipment).toLowerCase()
  const category = cleanText(exercise.category).toLowerCase()
  const instructions = cleanText(exercise.instructions?.en).toLowerCase()

  if (/\b(hold|plank|dead hang|wall sit|pose)\b/.test(name)) return 'duration'
  if (/\bstretch\b/.test(name) && /\bhold\b/.test(instructions)) return 'duration'
  if (equipment === 'assisted' || /^assisted\b/.test(name)) return 'assisted_reps'
  if (category === 'cardio') {
    return /\b(run|walk|cycle|crawl|elliptical)\b/.test(name) ? 'distance_duration' : 'duration'
  }
  if (equipment === 'body weight') return 'bodyweight_reps'
  return 'weight_reps'
}
