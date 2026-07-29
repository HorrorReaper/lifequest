# HTTP API and external providers

## General conventions

- Route handlers live under `src/app/api/`.
- JSON failures use an `error` string and an appropriate HTTP status.
- Authenticated routes obtain the current user from the cookie-backed Supabase server client.
- Provider secrets remain server-only.
- Nutrition provider responses use `Cache-Control: private, no-store`.

## `POST /api/waitlist`

Public endpoint used by the marketing waitlist.

Request:

```json
{
  "email": "person@example.com",
  "name": "Optional name",
  "hp": ""
}
```

- `hp` is a honeypot. A populated value returns success without processing.
- Email is validated with a basic format check.
- The current implementation logs accepted signups server-side and does not persist them or send them to a mailing provider.

Success:

```json
{ "ok": true }
```

## `DELETE /api/account`

Permanently deletes the current Supabase Auth user.

Request:

```json
{ "confirmation": "authenticated-email@example.com" }
```

Controls:

- Rejects a mismatched `Origin` header when one is supplied.
- Requires an authenticated user.
- Requires case-insensitive exact email confirmation.
- Requires `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`.
- Performs global Supabase sign-out before Admin API deletion.

Success:

```json
{ "deleted": true }
```

An already issued access token can remain valid until its short expiry even after global sign-out. RLS still applies during that interval until Auth deletion takes effect.

## `POST /api/chat`

Admin-only contextual assistant powered through OpenRouter.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Add a high priority task for tomorrow" }
  ]
}
```

Normalization:

- Roles are limited to `user` and `assistant`.
- Each message is trimmed to 1,200 characters.
- Empty messages are removed.
- Only the last 10 messages are sent.

Required controls:

- Authenticated user.
- `isAdminUser` authorization.
- `OPENROUTER_API_KEY`.
- Profile `ai_assistant_enabled=true`.
- Non-null `ai_consent_at`.

Context can include up to 15 tasks, 15 active habits, and 10 completed journal entries from the last 30 days, with bounded responses.

Supported model decisions:

- `none`
- `create_task`
- `complete_task`
- `create_habit`
- `check_habit`
- `analyze_journals`

The model returns strict-schema JSON. IDs must match records already supplied in context. The server executes recognized mutations through the current user's Supabase session.

Response:

```json
{
  "reply": "Added task: Prepare the proposal.",
  "action": {
    "type": "create_task",
    "status": "completed"
  }
}
```

The assistant is instructed not to provide medical, legal, financial, or crisis advice.

## `POST /api/goals/[goalId]/quest-suggestions`

Generates exactly three candidate quests for an owned admin goal.

Controls:

- Authenticated admin.
- The goal must belong to the current user.
- `OPENROUTER_API_KEY` must be configured.

The prompt includes goal details and up to 12 recent quests to reduce duplicates. OpenRouter returns strict-schema JSON.

Response:

```json
{
  "quests": [
    {
      "title": "Define the first customer segment",
      "description": "Write a one-page definition and list five prospects.",
      "xp_reward": 50,
      "coin_reward": 25
    }
  ]
}
```

The server trims title/description and clamps rewards to:

- XP: 25–100.
- Coins: 10–50.

Suggestions are not inserted automatically.

## `GET /api/admin/nutrition/foods/search?q=...`

Searches USDA FoodData Central and Open Food Facts in parallel.

Controls:

- Authenticated user.
- `isAdminUser`.
- Trusted `app_metadata.role = admin`.
- Query length 2–120 characters.

Response:

```json
{
  "foods": [
    {
      "source": "open_food_facts",
      "externalId": "12345678",
      "barcode": "12345678",
      "name": "Example food",
      "brand": "Example",
      "caloriesPer100g": 100,
      "proteinPer100g": 8,
      "carbsPer100g": 12,
      "fatPer100g": 2,
      "fiberPer100g": 1,
      "sugarPer100g": 3,
      "sodiumMgPer100g": 150,
      "defaultServingGrams": 100,
      "defaultServingLabel": "100 g",
      "portions": [],
      "attribution": "Open Food Facts"
    }
  ],
  "providers": {
    "usda": "ok",
    "openFoodFacts": "ok"
  }
}
```

Provider status values:

- USDA: `ok`, `disabled`, or `unavailable`.
- Open Food Facts: `ok` or `unavailable`.

A provider timeout/failure does not discard successful results from the other provider.

## `GET /api/admin/nutrition/foods/barcode/[code]`

Looks up an 8–14 digit barcode.

Controls are the same as food search.

Behavior:

1. Query Open Food Facts.
2. If no normalized result is available, query USDA when configured.
3. Normalize leading zeros when comparing USDA barcodes.

Responses:

- `200` with `{ "food": NormalizedFood }`.
- `400` invalid barcode.
- `404` unknown barcode.
- `503` providers unavailable.

## `POST /api/admin/nutrition/foods/import`

Refetches one external food and saves it into the current admin's local library.

Request:

```json
{
  "source": "usda",
  "externalId": "123456"
}
```

`source` is `usda` or `open_food_facts`.

The route:

1. Refetches data server-side; it does not trust browser nutrient values.
2. Normalizes the food.
3. Upserts on `(user_id, source, external_id)`.
4. Replaces stored portion rows with the normalized set.
5. Returns the local food plus provider attribution.

Success status is `201`. An incomplete normalized record returns `422`; provider/import failures return `502`.

The food upsert and portion replacement are not one database transaction. A food may therefore exist without its refreshed portions if the second write fails.

## External service configuration

| Variable | Used by | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Chat and quest suggestions | Server-only |
| `OPENROUTER_MODEL` | Chat and quest suggestions | Defaults to `openai/gpt-4o-mini` |
| `OPENROUTER_SITE_URL` | OpenRouter referral header | Falls back to `NEXT_PUBLIC_APP_URL` |
| `USDA_FDC_API_KEY` | USDA search/detail/barcode | Server-only; provider is disabled when absent |
| `OPEN_FOOD_FACTS_USER_AGENT` | Open Food Facts | Descriptive user agent; has a local fallback |
| `SUPABASE_SECRET_KEY` | Account deletion | Server-only |

Provider contracts can change. Normalizers in `src/lib/nutrition/food-normalizers.ts` are the boundary between external JSON and the internal `NormalizedFood` model.

