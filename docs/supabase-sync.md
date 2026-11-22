# Account sync: Google sign-in on Supabase

Nghe Nối Âm can sign in with Google and keep the learner's data in the **same Supabase project as daily-english**
(`D:\Test\daily-english`, the "main" project that holds daily-english's users and auth). It is a third sync channel
next to folder sync (OneDrive…) and the JSON backup, not a replacement: without a network, without signing in, or in
a build without the project configured, the app behaves exactly as before (localStorage only).

Code: `src/core/cloud/` (`config.ts`, `auth.ts`, `remote.ts`, `cloudSync.ts` pure + tested, `cloudController.ts`
browser glue), UI `src/features/settings/CloudSection.tsx` ("Tài khoản" card in Cài đặt) and the shared
`src/components/SyncBanner.tsx`. SQL: `daily-english/supabase-migrations/18-create-nghe-noi-am-sync.sql`.

## 1. How daily-english uses Supabase (read 2026-11-22)

- Two projects. **Main** (`pxxbalgsvnpvxhnnkeyg.supabase.co`): Supabase Auth with **Google only** (`email` is also on in
  the project settings), tables `users`, `user_progress`, `user_favorites`, `user_achievements`, `user_rewards`,
  `user_reviews`, `learning_path_progress`, `user_skill_data` (generic per-user JSON blobs), all with RLS
  "own rows only". **Tracking** (a second project): `user_exercise_history`, `daily_challenges`, `weekly_goals`,
  authenticated by forwarding the main project's JWT in an `x-auth-token` header.
- Client: `@supabase/supabase-js` with `flowType: 'pkce'`, `detectSessionInUrl`, redirect `${origin}/home` (site
  `dailyenglish.qzz.io`, `CNAME`). URL + publishable key come from `src/environments/environment*.ts` (git-ignored)
  and, for the deploy, from repository secrets written into `environment.prod.ts` by the workflow.
- New sign-ups are refused when the database passes 410 MB (`auth.service.ts`, `get_database_size_mb`). Nghe Nối Âm
  does not create a `users` row; its table references `auth.users` directly.

Nghe Nối Âm uses only the **main** project. It does not use supabase-js: four GoTrue calls (authorize, PKCE token,
refresh, logout) and three PostgREST calls are a few hundred lines (`auth.ts`, `remote.ts`) and keep the portable file
small.

## 2. Storage design

Table `public.nna_sync`, one row per (user, storage key):

| column | |
|---|---|
| `user_id` | `auth.users(id)`, default `auth.uid()`, cascade delete |
| `key` | the app's short storage key (`review-cards`, `listening-log`, `settings`…), `^[a-z0-9][a-z0-9-]{0,63}$` |
| `value` | the raw JSON text of that localStorage key (text, so a client compares it byte for byte), ≤ 5 MB |
| `rev` | from one global sequence, new on every insert/update (set by a trigger, never by the client): a different rev means "someone else wrote it", even after delete + re-insert |
| `device`, `updated_at` | for the learner's eyes / the merge of keys without their own change time |

- RLS: select / insert / update / delete only where `auth.uid() = user_id`, role `authenticated`; nothing for `anon`.
- Writes go through `nna_sync_write(changes jsonb, device text)` (SECURITY INVOKER, so RLS applies): every change names
  the rev it was built on (`base`, or null for "no row yet"); the batch is applied **only if none of those rows
  changed** (compare-and-swap, all or nothing), else it returns `{ ok: false, error: 'conflict' }` and writes nothing.
  A learner's rows are capped at 25 MB in total (`quota`), because the project's free 500 MB is shared with
  daily-english.
- What travels: exactly what folder sync and the backup carry (`exportBackup`): every `nghe-noi-am:` key except
  `DEVICE_LOCAL_KEYS`. Never: the AI config and key (`nghe-noi-am-device:` prefix), the paid-voice choice
  (`voice-ai`), the running stopwatch, the checkup draft, the account session itself.

## 3. One sync cycle (`cloudSync.ts`)

This browser keeps, per key, the `rev` and a hash of the value it last synced (its **base**, device-local key
`nghe-noi-am-device:cloud-sync`). A cycle:

1. lists the rows' `key, rev` (one small request); fetches values only for rows whose rev differs from the base;
2. per key: remote rev = base rev → nobody else wrote it, this browser's value (or its delete) stands; remote changed
   and local unchanged → take theirs; both changed → both sides go to the merge; row gone and local unchanged →
   deleted here too;
3. merges with **`mergeData` from `core/syncMerge.ts`**: the same mergers, reset markers and tombstones as folder
   sync. The reset marker always keeps this browser's own value in the local side, so "Xóa dữ liệu", a restore or
   "Xóa lịch sử" made elsewhere drops this browser's older data instead of merging it back (same promise as folder
   sync, tested). Remote values are sanitised like a backup import (settings through `sanitizeSettingsJSON`, broken
   JSON or device-local keys ignored and never deleted);
4. applies the result here (only before the first render, or after a click: otherwise it writes nothing and shows the
   banner "Có dữ liệu mới trong tài khoản → Tải lại"), then writes the differences with compare-and-swap. On a
   conflict it starts over (3 tries). On a network error nothing is lost: unwritten keys still differ from their base
   and go out next time.

A first connection (first sign-in on this browser, or another account) merges both sides without honouring resets,
like folder sync's "Gộp": nothing is replaced. Sign-out keeps the data here and in the account and forgets the base.

When: at start (≤ 1.5 s before the first render, sharing one queue with folder sync: `core/syncLock.ts`), 4 s after
a local change, when the page is hidden or comes back, on `online`, every 5 minutes while visible, and on
"Đồng bộ ngay". Network errors are quiet (status "Đang ngoại tuyến" in Cài đặt); an ended session shows the banner.

## 4. Sign-in

PKCE with the code verifier in device-local storage (`nghe-noi-am-device:cloud-pkce`, forgotten after 30 minutes).
The session (access + refresh token, user id, email, name) is in `nghe-noi-am-device:cloud-session`: never synced or
backed up, kept by "Xóa dữ liệu" (which then empties the account's copy too). Tokens refresh a minute before expiry,
under a cross-tab lock where the browser has `navigator.locks`; a refused refresh ends the session ("Cần đăng nhập
lại"), the data stays.

- **Web (GitHub Pages, dev server):** "Đăng nhập bằng Google" → Google → back to the same page with `?code=…` → the
  code is exchanged, the first sync runs (merge), the page reloads if data changed.
- **Portable file (`file://`, origin `null`):** Google cannot send a browser back to a file. The file opens the WEB app
  in a new tab with `redirect_to=<web app>?nna_login=portable`; after Google the web app does not use the code but
  shows it ("Mã đăng nhập cho bản mở từ ổ đĩa", "Chép mã"); the learner pastes it into the file, which exchanges it
  with the verifier only it holds (a code without its verifier is useless, so showing it is safe). Supabase's API
  answers `Origin: null` (checked 2026-11-22: REST preflight `Access-Control-Allow-Origin: *`, Auth `null`), so after
  that the file syncs directly. Limits: it needs the network once per sign-in and a pop-up allowed; Chromium gives
  every `file://` page one storage origin, so any local HTML file opened in the same browser could read the session
  (same caveat as the AI key, docs/ai-providers.md).

## 5. Setup the owner has to do (not done by any agent)

1. **Run the migration** `daily-english/supabase-migrations/18-create-nghe-noi-am-sync.sql` in the main project's SQL
   editor (safe to run twice). It only adds `nna_sync`, its sequence, trigger, policies and `nna_sync_write`; no
   daily-english table changes. **Done 2026-11-22**; checked afterwards through the Supabase MCP: RLS on, 4 policies,
   the trigger, execute for `authenticated` only, nothing for `anon`, advisors without new warnings.
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: add
   `https://hnp180493.github.io/english-listening/**` and, for local work, `http://localhost:5173/**`. Without it
   Supabase sends the learner to the Site URL (daily-english) instead of back to Nghe Nối Âm. The Google provider and
   its Google Cloud client need no change (the callback stays `https://<project>.supabase.co/auth/v1/callback`).
3. **Build values** (never in the repository): GitHub → english-listening → Settings → Secrets → Actions:
   `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the workflow passes them as `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY`). For local and portable builds: `.env.local` from `.env.example`. A
   `sb_secret_…` key is refused by `parseCloudConfig`. A publishable key is meant to be public (it ships in the page
   bundle, and so in the portable file); RLS is what protects the data.

## 6. Sharing data with daily-english (proposal, nothing built)

Today the two apps share **the account** (same Google sign-in, same `auth.users` id) and nothing else: Nghe Nối Âm only
reads and writes `nna_sync`; daily-english's tables are untouched. Real sharing needs a decision from the owner and,
for anything daily-english should show or write, changes in daily-english:

| What | Direction | Cost |
|---|---|---|
| Real listening time (Nhật ký nghe) | daily-english's listening practice adds minutes to Nghe Nối Âm's `listening-log` row (same entry format, its own ids) | daily-english code; merge already handles it |
| "Học hôm nay" streak across both apps | each app reads the other's active days (Nghe Nối Âm: `stats.activeDays` in `nna_sync`; daily-english: `user_progress.lastStreakDate/currentStreak`, compressed format) | read-only display in each app; daily-english's progress format is compressed (`20251126_compress_*`), so a small view or function is safer than parsing it in the browser |
| Words learned (Nghe Nối Âm irregular / loanword cards ↔ daily-english flashcards in `user_skill_data`) | copy or show | different card models and SRS; most work, least clear value |

Recommended first step: the listening minutes (one direction, no schema change), then a read-only "cả hai app" streak.

## 7. Checked / not checked (2026-11-22)

Checked:
- 34 unit tests (`src/core/cloud/*.test.ts`): two and three browsers against an in-memory table with the server's
  rules (first connection merge, steady state with one request, both sides changed, settings by their own change time,
  a write landing between read and write, offline, broken remote values, sanitised settings, key delete, tombstoned
  custom sentence, "Xóa dữ liệu", restore, "Xóa lịch sử", failed write keeps the base); auth URL / PKCE (RFC 7636
  vector) / callback parsing / token errors; REST request shapes and error mapping. Two deliberate breakages
  (reset marker rule, CAS check) each made a test fail.
- The migration on PGlite (Postgres in Node) with a stand-in `auth.uid()` and the `anon` / `authenticated` roles:
  runs twice; RLS hides user A's rows from user B and blocks B's insert as A; `anon` can neither read nor call the
  function; stale `base` → conflict, and a batch with one stale change writes nothing; deletes with and without base;
  client-chosen `rev` ignored; the 25 MB cap rolls the batch back.
- In the dev server against a local mock of the two REST endpoints, with a fake session: the startup pull, a settings
  change written 4 s later, newer remote data while the page is open → banner → "Tải lại" merges and keeps the local
  change, sign-out keeps the data, the authorize redirect URL, the portable code card; 375 px dark (no sideways
  scroll) and desktop dark; in light only the banner was looked at.
- Against the real project, read-only: `/auth/v1/settings` (Google on), CORS for `Origin: null`, `/authorize` redirects
  to Google.

Not checked:
- **Nothing against the real project with a real account**: the migration is in place (above), but no real Google
  sign-in, token exchange, refresh, or row written yet.
- The portable flow end to end (`npm run portable` was not run with the values; the paste-code step only seen from
  the web side), `navigator.locks` refresh across two real tabs, iOS Safari.
- Real latency: the 1.5 s startup budget with a slow network and folder sync both on.
