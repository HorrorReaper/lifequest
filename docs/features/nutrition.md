# Nutrition tracker

## Scope and access

The nutrition tracker is a MyFitnessPal-inspired diary at `/admin/nutrition`. It is admin-only and retains the LifeQuest visual identity.

Out of scope:

- Advertising and Premium concepts.
- Community/social features.
- Water tracking.
- Meal planning.
- Health-platform integrations.
- Full micronutrient tracking.

## Diary

The default view is organized around a selected date.

The summary presents:

```text
Goal − Food = Remaining
```

It also shows protein, carbohydrate, and fat progress plus day and weekly-average context.

The diary has five fixed meal sections:

- Breakfast.
- Lunch.
- Dinner.
- Snacks.
- Other.

Each meal supports Add Food and quick tools. Existing entries can be edited, duplicated, moved, copied to another date, or deleted. Meal contents can also be duplicated, moved, or copied.

## Food search

The search experience provides:

- Recent.
- Frequent.
- Favorites.
- My Foods.
- Saved Meals.
- Recipes.
- External results.

Recent and frequent rankings are derived from existing diary history. Local and saved results remain usable even when external providers are unavailable.

## Portions and nutrient scaling

Food definitions store canonical nutrients per 100 grams:

- Calories.
- Protein.
- Carbohydrates.
- Fat.
- Fiber.
- Sugar.
- Sodium.

A portion defines a gram weight. Logging accepts a portion and serving count, while custom grams remain available.

The basic scale factor is:

```text
portion grams × serving count / 100
```

Each nutrient is multiplied by that factor. Milliliters are only appropriate when the source has a trustworthy gram conversion.

## Snapshot behavior

Diary entries store a nutrient snapshot, not only a pointer to a mutable food:

- Food identity/source details are retained.
- `entry_kind` is preserved while editing.
- Calories and macro/micro values are stored on the entry.
- Later edits to a food or recipe do not rewrite historical entries.

Any new edit path must use the shared diary helpers so it does not silently turn a food entry into a quick add or recompute history from a changed product.

## Quick add

Quick Add remains available for manual calorie and macro logging without creating a complete reusable food definition.

## Saved meals

A saved meal is a reusable collection of foods and quantities. Logging a saved meal uses an atomic `log_saved_meal` RPC, so all diary entries are created together.

## Recipes

A recipe contains:

- Ingredient foods and quantities.
- Number of portions.
- Optional total yield weight.

Recipe totals are derived from ingredients and divided by the configured portions. Logging uses the `log_recipe` RPC and stores snapshots in the diary.

Creating the reusable saved-meal or recipe definition still uses a parent write followed by item writes, with client-side cleanup on failure. See [Known constraints](../reference/known-limitations.md).

## External food providers

### USDA FoodData Central

USDA search requires the server-only `USDA_FDC_API_KEY`. Missing configuration disables only that provider.

### Open Food Facts

Open Food Facts supports search and barcode lookup. Configure a descriptive server-only `OPEN_FOOD_FACTS_USER_AGENT`.

### Failure handling

- Search runs providers in parallel.
- Each provider has a seven-second timeout.
- Provider status is returned separately, so a partial success still produces results.
- Responses are private and `no-store`.
- Local foods remain available independently.

## Barcode workflow

Barcodes must contain 8–14 digits.

The lookup order is:

1. Open Food Facts.
2. USDA fallback where available.

The mobile camera scanner lazy-loads ZXing only when needed. Manual barcode entry is always available as a fallback.

## Import and deduplication

Selecting an external food can import it into the user's local food library. The server refetches the provider record rather than trusting client nutrient values.

Imported food upsert identity includes the user, source, and external provider ID. Source normalization also supports deduplication by:

- Barcode with a leading zero normalized where appropriate.
- Normalized brand and product name when no reliable barcode exists.

Portions are replaced with the latest normalized provider portions during import.

## Targets

Nutrition targets provide the daily calorie and macro goals used by the diary summary. They are user-owned and protected by admin RLS.

## Important implementation files

- `src/components/admin/NutritionHub.tsx`
- `src/components/admin/nutrition/`
- `src/lib/nutrition/`
- `src/app/api/admin/nutrition/foods/`
- Nutrition tables/RPCs in `src/lib/supabase/database.types.ts`

