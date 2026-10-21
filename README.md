# Diet Evidence app prototype

A prototype of the evidence-based diet app. Users log meals by photo or description, and the app does three things:

- Tracks calories, macronutrients, and vitamins and minerals against official reference intakes.
- Judges the overall diet against a library of evidence-graded claims, giving a rating, a confidence level and sources.
- Checks pasted "fad" claims against the same library.

**The claim library is a draft.** All 34 claims in `data/claims.json` are marked `draft`. They must be reviewed by a registered dietitian or nutrition scientist before anyone outside the team uses the app. The app labels draft claims on screen.

## How it fits together

| Part | Where | What it does |
| --- | --- | --- |
| Mobile app | `mobile/` | Expo (React Native) + TypeScript, Expo Router. Five tabs: Today, My Diet, Fad Check, Library, Me. |
| Database | `supabase/migrations/` | Postgres with row level security; each user only sees their own data. |
| Evidence library | `data/claims.json` → `supabase/seed.sql` | Claims, confidence grades, triggers and sources. |
| `log-meal` function | `supabase/functions/log-meal` | Photo or text → Claude Sonnet 5.5 → foods with gram estimates → USDA nutrients. Saves the confirmed meal. |
| `nutrition-summary` function | `supabase/functions/nutrition-summary` | Today's totals and the 7-day average against the user's targets. |
| `diet-verdict` function | `supabase/functions/diet-verdict` | Builds the 14-day diet profile, applies fixed rules, and asks Claude to explain the claims the rules chose. |
| `fad-check` function | `supabase/functions/fad-check` | Claude Haiku 5.5 extracts claims, Claude Sonnet 5.5 matches them to the library, and fixed rules set the verdict. |

**How verdicts stay grounded:**

- The rating and confidence come from deterministic rules in `supabase/functions/_shared/rules.ts`, not from the model.
- Claude only writes explanations of the claims those rules selected.
- A citation check drops any sentence that doesn't cite one of those claims.

The Anthropic API key lives only in the Supabase functions, never in the app.

## Setup

You need Node 20+, the [Supabase CLI](https://supabase.com/docs/guides/cli), an [Anthropic API key](https://console.anthropic.com) and a free [USDA FoodData Central key](https://fdc.nal.usda.gov/api-key-signup). For the local Supabase stack you also need Docker.

### Quick start (macOS or Linux)

```bash
scripts/dev.sh          # starts Docker if needed, Supabase, the edge functions and the Expo dev server
scripts/dev.sh stop     # stops Supabase; your data is kept
```

The script writes your machine's LAN address and the local API key into `mobile/.env`, and installs the app's dependencies when the lockfile changes. It starts the edge functions only once `supabase/functions/.env` has your API keys. Extra arguments go to `expo start`, for example `scripts/dev.sh --tunnel`. The steps below do the same thing by hand.

### 1. Backend, local

```bash
supabase start                      # starts Postgres, auth and the functions runtime; applies migrations and seed.sql
cp supabase/functions/.env.example supabase/functions/.env   # then fill in ANTHROPIC_API_KEY and USDA_API_KEY
supabase functions serve --env-file supabase/functions/.env
```

`supabase status` prints the API URL and anon key for the next step.

### 1. Backend, hosted (alternative)

```bash
supabase link --project-ref <your-project-ref>
supabase db push --include-seed     # applies the migration and loads the claim library
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... USDA_API_KEY=...
supabase functions deploy log-meal nutrition-summary diet-verdict fad-check
```

Then enable **Anonymous sign-ins** under Authentication → Sign In / Providers in the dashboard.

### 2. Mobile app

```bash
cd mobile
npm install
cp .env.example .env                # set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Scan the QR code with Expo Go on your phone. When running the backend locally, use your computer's LAN IP address in `EXPO_PUBLIC_SUPABASE_URL` instead of `127.0.0.1` so the phone can reach it.

## Editing the claim library

Edit `data/claims.json`, then regenerate the seed and re-run the tests:

```bash
node scripts/build-seed.mjs
cd supabase/functions && deno test --allow-read tests/
```

Each claim's `triggers` link it to the diet profile. For example, `{ "signal": "fiber_g_per_day", "op": "<", "value": 20, "stance": "gap" }` flags low fibre as a gap. Available signals are built in `supabase/functions/_shared/profile.ts`, and a test fails if a trigger names a signal that doesn't exist.

## Checks

```bash
cd supabase/functions && deno test --allow-read tests/ && deno check */index.ts
cd mobile && npx tsc --noEmit
```

The tests cover:

- Nutrient mapping, targets and the diet profile, including time zones.
- Verdict rules and the citation check.
- Claim triggers.

The Claude and USDA calls are not covered by automated tests.

## Known limitations

- **Portion and salt estimates from photos are rough.** Users correct the gram amounts on the confirm screen. Sodium is likely underestimated.
- **USDA data has gaps.** Some foods lack micronutrient data, and added sugar is rarely reported, so total sugar stands in for sweets and sugary drinks.
- **Targets use general reference intakes.** Calorie needs come from a by-age-and-activity table, not a personal calculation.
- **No barcode scanning, link or video fad checks, weekly report or payments yet.** These are later phases in the spec.
- **Anonymous accounts only.** Signing out loses the data.

## Cost

Each photo log costs about $0.013 on Sonnet 5.5, and a verdict about $0.02. Each call logs token usage to the function logs. To cut costs further:

- Try `CLAUDE_PHOTO_MODEL=claude-haiku-5-5` for photo logging.
- The claim library sits in a cached system prompt, so keep `libraryText()` output stable to keep the cache working.
