# Supabase setup for Ourcade leaderboards

One-time setup. ~15 minutes start to finish.

---

## 1. Create a project

1. Go to https://supabase.com and sign up (use GitHub for fastest setup).
2. Click **New project**.
3. Fill in:
   - **Project name:** `ourcade`
   - **Database password:** generate one and save it — you won't need it day-to-day, but losing it is annoying.
   - **Region:** pick the one closest to most of your players (US-East works for most).
   - **Pricing plan:** Free.
4. Wait ~1 minute while Supabase provisions everything.

## 2. Grab your credentials

In the project dashboard, sidebar → **Settings → API**.

Copy:
- **Project URL** (looks like `https://abcdefg.supabase.co`)
- **`anon` `public` key** (a long JWT)

Paste them into `src/lib/supabase-config.ts`:

```ts
export const SUPABASE_URL = 'https://abcdefg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

The anon key is *meant* to be public — it's how client apps authenticate as anonymous users. Your security comes from RLS policies (next step).

## 3. Run the schema SQL

Sidebar → **SQL Editor** → **New query**. Paste the block below and click **Run**.

```sql
-- Score rows. One per finished arcade run that the player chose to submit.
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  initials text not null check (length(initials) = 3),
  score numeric not null,
  unit text not null default 'PTS',
  level integer,
  taps integer,
  city text,
  created_at timestamptz not null default now()
);

-- Indexes for fast leaderboard queries.
-- Most leaderboard reads are "top scores for game X" or "player rank for
-- game X" — both of which want (game_id, score) sorted appropriately.
create index if not exists scores_game_high
  on scores (game_id, score desc, created_at desc);

create index if not exists scores_game_low
  on scores (game_id, score asc, created_at desc);

create index if not exists scores_game_initials
  on scores (game_id, initials);
```

## 4. Lock the table down with RLS

Without RLS, anyone with the anon key could DELETE the whole table. Add it now:

```sql
-- Enable Row-Level Security.
alter table scores enable row level security;

-- Anyone (anon role) can read scores. Public leaderboard, public reads.
create policy "anyone can read scores"
  on scores for select
  to anon, authenticated
  using (true);

-- Anyone can insert a row, BUT we constrain what they can submit:
--   - initials must be exactly 3 uppercase letters
--   - score must be finite and non-negative (or non-zero for the
--     "lower is better" games — adjust if you want stricter)
--   - city / level / taps are optional
-- This blocks the most obvious abuse without being so strict it
-- rejects legitimate scores.
create policy "anyone can insert valid scores"
  on scores for insert
  to anon, authenticated
  with check (
    initials ~ '^[A-Z]{3}$'
    and score >= 0
    and score < 1e12
  );

-- Nobody can update or delete via the anon key. Admins can do this
-- via the dashboard if needed.
-- (No policies for UPDATE / DELETE = no one can do them.)
```

Run that block too.

## 5. Seed data (optional but recommended)

Apple reviewers and your first 10 users should see a populated leaderboard, not empty tables. Paste this in the SQL Editor and run:

```sql
insert into scores (game_id, initials, score, unit, level, taps, created_at) values
  ('tap-bullseye', 'KAT', 187420, 'PTS', null, null, now() - interval '1 day'),
  ('tap-bullseye', 'NOX', 152890, 'PTS', null, null, now() - interval '2 days'),
  ('tap-bullseye', 'ZIP', 124650, 'PTS', null, null, now() - interval '3 hours'),
  ('tap-bullseye', 'BLZ',  76540, 'PTS', null, null, now() - interval '1 day'),
  ('tap-bullseye', 'ZEN',  54200, 'PTS', null, null, now() - interval '5 hours'),
  ('tap-bullseye', 'AAA',  47830, 'PTS', null, null, now() - interval '4 days'),
  ('minesweep',    'KAT', 78753, 'LV',  8, 1247, now() - interval '5 hours'),
  ('minesweep',    'NOX', 69032, 'LV',  7,  968, now() - interval '1 day'),
  ('minesweep',    'ZIP', 59219, 'LV',  6,  781, now() - interval '2 days'),
  ('minesweep',    'BLZ', 49349, 'LV',  5,  651, now() - interval '3 days'),
  ('tilt-maze',    'KAT',  9781600, 'LV', 10, 218400, now() - interval '5 hours'),
  ('tilt-maze',    'NOX',  8804900, 'LV',  9, 195100, now() - interval '1 day'),
  ('tilt-maze',    'ZIP',  7832100, 'LV',  8, 167900, now() - interval '2 days'),
  ('tilt-maze',    'BLZ',  5871300, 'LV',  6, 128700, now() - interval '4 days'),
  ('walk-the-line','KAT', 16240, 'PTS', null, null, now() - interval '5 hours'),
  ('walk-the-line','NOX', 14880, 'PTS', null, null, now() - interval '1 day'),
  ('walk-the-line','ZIP', 13420, 'PTS', null, null, now() - interval '2 days'),
  ('slipstream',   'KAT', 64280, 'PTS', null, null, now() - interval '5 hours'),
  ('slipstream',   'NOX', 51760, 'PTS', null, null, now() - interval '1 day'),
  ('slipstream',   'ZIP', 42910, 'PTS', null, null, now() - interval '2 days'),
  ('dead-air',     'ZEN', 12420, 'SEC', null, null, now() - interval '5 hours'),
  ('dead-air',     'KAT',  8970, 'SEC', null, null, now() - interval '1 day'),
  ('dead-air',     'NOX',  6340, 'SEC', null, null, now() - interval '2 days'),
  ('trivia',       'KAT',  9420, 'PTS', null, null, now() - interval '5 hours'),
  ('trivia',       'NOX',  8870, 'PTS', null, null, now() - interval '1 day'),
  ('trivia',       'ZIP',  7980, 'PTS', null, null, now() - interval '2 days'),
  ('draw-it',      'KAT',  4620, 'PTS', null, null, now() - interval '5 hours'),
  ('draw-it',      'ZIP',  4180, 'PTS', null, null, now() - interval '1 day'),
  ('draw-it',      'BLZ',  2820, 'PTS', null, null, now() - interval '3 days'),
  ('pulse',        'KAT', 32140, 'PTS', null, null, now() - interval '5 hours'),
  ('pulse',        'NOX', 24690, 'PTS', null, null, now() - interval '1 day'),
  ('pulse',        'ZIP', 18420, 'PTS', null, null, now() - interval '2 days'),
  ('memory-grid',  'KAT', 12100, 'PTS', null, null, now() - interval '5 hours'),
  ('memory-grid',  'NOX',  9450, 'PTS', null, null, now() - interval '1 day'),
  ('memory-grid',  'ZIP',  7800, 'PTS', null, null, now() - interval '2 days'),
  ('stroop',       'KAT', 28640, 'PTS', null, null, now() - interval '5 hours'),
  ('stroop',       'NOX', 21380, 'PTS', null, null, now() - interval '1 day'),
  ('stroop',       'ZIP', 16210, 'PTS', null, null, now() - interval '2 days'),
  ('polaroid',     'KAT',  9420, 'PTS', null, null, now() - interval '5 hours'),
  ('polaroid',     'NOX',  8870, 'PTS', null, null, now() - interval '1 day'),
  ('polaroid',     'ZIP',  8210, 'PTS', null, null, now() - interval '2 days');
```

## 6. Run the app

```bash
cd ~/Documents/WEgomaniac/sensor-arcade
npm install
npx expo start --tunnel
```

Open Expo Go and scan the QR. The first time you tap the lobby:
- If `supabase-config.ts` still has placeholders → you'll see mock data (a console warning will print).
- If real credentials are in place → you'll see whatever's in your seed data + any scores submitted from the device.

Submit a score (play any cabinet, tap SUBMIT on the result screen) and confirm it appears in Supabase via:
- Dashboard → Table Editor → scores

Or via SQL Editor:
```sql
select * from scores order by created_at desc limit 10;
```

## 7. (Optional) Real-time updates

To make the lobby update live when other players post scores:

```ts
// somewhere in your boot path
supabase
  ?.channel('scores-feed')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' }, (payload) => {
    // append payload.new to the local cache
  })
  .subscribe();
```

Skip this for v1 — periodic re-loads are simpler.

## Anti-abuse — when you start caring

Common ways the leaderboard gets griefed and easy mitigations:

1. **Spam inserts.** Add a rate limit via a Postgres function: a player can only submit 1 score every 30s for the same game. Or use Supabase Edge Functions to validate the run server-side.
2. **Impossible scores.** Tighten the RLS check with per-game upper bounds (e.g., `tap-bullseye` max 1,000,000).
3. **Profanity in initials.** Add a regex to reject the obvious 3-letter words. RLS policy already forces uppercase A-Z.

None of this matters until the app has actual users. Ship first.

## Cost

Free tier covers:
- 500 MB database
- 2 GB egress per month
- 50,000 monthly active users
- Unlimited API requests

You'd need ~5 million scores to hit 500 MB. Bandwidth-wise, each leaderboard load is ~50 KB, so ~40,000 loads/month before egress matters. By that point you're at thousands of DAU and a $25/mo Pro tier is fine.
