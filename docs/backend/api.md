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
- An accepted signup is saved to `waitlist_signups` through `createPublicRouteClient` (`src/lib/supabase/public-route-client.ts`); a duplicate address answers 409.
- After saving, the route records a `waitlist_signup` landing event with the same visitor hash as the visitor's page views and the form's `source` as its CTA name, and no address or name ([Landing-page traffic](../features/landing-traffic.md)). A failure there is logged and does not change the answer.

Success:

```json
{ "ok": true }
```

## `POST /api/landing-events`

Public endpoint used by the landing page's tracker (`src/lib/landing-tracker.ts`, sent with `navigator.sendBeacon`). Listed in `publicRoutes` in `src/lib/supabase/middleware.ts`, because `/api/:path*` is in the proxy matcher.

Request (at most 2048 bytes):

```json
{
  "event": "pageview",
  "path": "/",
  "referrer": "https://news.ycombinator.com/item?id=1",
  "utm_source": "hn",
  "utm_medium": "social",
  "utm_campaign": "launch"
}
```

- `event` is `pageview` or `cta_click`. `waitlist_signup` is refused; only `/api/waitlist` records it.
- `cta` is required for `cta_click`: 1–40 characters of `a-z`, `0-9`, `_`, `-`.
- `path` must be a tracked page (currently `/`); query and fragment are stripped.
- `referrer` is reduced to its host; UTM values are trimmed, lower-cased and cut to 100 characters.

Responses:

- `204` with no body: recorded, or dropped on purpose (bot, prefetch, more than 40 events in ten minutes from one visitor). The two are not distinguishable. A failed insert is logged and also answers 204.
- `400` `{ "ok": false, "error": "..." }`: malformed JSON, unknown event, untracked path, invalid CTA.
- `413`: body over 2048 bytes.
- `500`: Supabase environment variables missing.

All responses carry `Cache-Control: no-store`. The route sends the database a SHA-256 hash of IP and user agent and a device bucket, never the raw values; see [Authentication, authorization, and privacy](auth-security.md#landing-page-traffic).

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


## Projects workspace APIs

The Projects workspace uses Supabase Data API tables/views and RPCs rather than new HTTP endpoints. `get_project_board` returns `{ version, tasks }` in one database snapshot. `reorder_project_tasks` accepts the project ID, expected version and full ordered main-task array (`id`, `status`, `sort_order`). Conflicts reject the transaction with `BOARD_CONFLICT`. Task family save/assign/delete RPCs use the expected task `updated_at` and reject stale writes with `TASK_CONFLICT`. Project metadata updates filter by the previously read `updated_at`. See the Projects additions in `data-model.md` for the full RPC inventory.

## Contacts RPCs
contacts_management provides ensure_contact_defaults, list_contacts (50 rows plus complete counts), get_contact_detail, contact_event_occurrences (maximum 800-day window), contact_reminders (profile timezone), save_contact_record, delete_contact_record, link_contact_resource, set_contact_occurrence and create_contact_occurrence_task. Existing edits/deletes require expected updated_at; stale edits raise CONTACT_CONFLICT. All execute as the owner with a trusted admin claim. Event preparation task creation locks the event and returns the same task for an existing occurrence.
