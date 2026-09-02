# The Carnival Queen

Full-stack pageantry platform: contestant voting (coin-based wallet), live leaderboards via Socket.io,
event ticketing with QR + fallback codes, contestant registration/approval workflow, and an admin panel.

**Stack:** Node.js, Express, PostgreSQL + Sequelize (Neon-ready), EJS, Tailwind CSS (CDN), Socket.io, Paystack, Cloudinary.

## 1. Install

```bash
npm install
cp .env.example .env
```

`npm install` automatically compiles Tailwind CSS via a `postinstall` hook. If you ever edit
`public/css/input.css` or `tailwind.config.js` directly, rebuild with `npm run build:css`, or run
`npm run dev` (below) which watches and rebuilds automatically while you work.

Fill in `.env`:
- `DATABASE_URL` — your Neon connection string (Neon dashboard → Connection Details → "Connection string" with `?sslmode=require`). Both local dev and production use this same variable; there's no separate host/user/password config to keep in sync.
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your Paystack dashboard.
- `PAYSTACK_VOTE_SPLIT_CODE` — the split code you create in Paystack (Dashboard → Split Payments). **This is applied only to coin bundle purchases.** Ticket purchases are initialized without it, so 100% of ticket revenue goes to your main settlement account.
- `CLOUDINARY_*` — from your Cloudinary dashboard (used for contestant photos, application documents, gallery images).

If you're using local Postgres instead of Neon and it isn't configured for SSL, set `DB_SSL=false`.

## 2. Database

Tables are created (and kept up to date) automatically on every boot via `sequelize.sync({ alter: true })`
in `app.js` — no manual migration step needed for local dev. Just start the app once:

```bash
npm run dev
```

Check your terminal for `Database connected.` / `Database tables ready.` — then stop it and seed demo data:

```bash
npm run seed
```

(The `migrations/` folder is still included if you'd rather run controlled, reviewable migrations in
production instead of `alter: true` — see note below.)

Seed data includes:
| Account | Email | Password | Role |
|---|---|---|---|
| Super Admin | admin@carnivalqueen.test | Password123! | superadmin (sees everything, incl. revenue) |
| Admin | manager@carnivalqueen.test | Password123! | admin (operational only, no revenue/transactions) |
| Staff | staff@carnivalqueen.test | Password123! | staff (check-in only) |
| Voter | voter@carnivalqueen.test | Password123! | voter, pre-loaded with 10,000 coins |

Two editions are seeded: **2025** (archived, has a winner set) and **2026** (current, open for voting) —
this drives the "last year's winner" vs "this year's contestants" split on the home page.
A sample coronation-night event is seeded for ticket purchase testing.

Contestant photos are seeded with a placeholder image at `public/img/placeholder.jpg` — replace via
the admin panel's contestant photo upload once Cloudinary is configured.

## 3. Run

```bash
npm run dev   # nodemon + Tailwind watcher together, auto-restarts/rebuilds on changes
# or
npm start     # production - make sure you've run `npm run build:css` at least once
```

Visit `http://localhost:3000`.

> **Note on `sync({ alter: true })` vs. migrations:** auto-sync is convenient for development and
> small deployments — it never drops columns or tables, only adds what's missing — but it can't
> express things like renaming a column or backfilling data safely. Once this is handling real
> money and real votes in production, consider switching `app.js` to just `sequelize.authenticate()`
> and running `npm run migrate` as a deploy step instead, so schema changes are reviewable and
> reversible.

## 3b. Troubleshooting: "Error" with a bare stack trace on startup

If a page throws an error whose message is cut off in your terminal (just a stack trace, no
readable message), it's almost always one of these, in order of likelihood:

1. **`DATABASE_URL` isn't set or is wrong** - double check it's a full Neon connection string with
   `?sslmode=require`, pasted into `.env` (not `.env.example`). The app now fails fast on boot with
   a clear message if it can't connect, instead of failing later on the first query.
2. **SSL mismatch on local Postgres** - if you're pointing at local Postgres instead of Neon and it
   isn't configured for SSL, set `DB_SSL=false` in `.env`.
3. **Seed data hasn't been loaded** - tables exist but are empty, so pages relying on a "current
   edition" render blank rather than erroring. Run `npm run seed`.

The app logs the full underlying error (including Sequelize's `err.original`/`err.parent`, which is
where the actual Postgres error message hides) to your terminal, and renders it on-page in
development mode.

## 3c. Troubleshooting: "Request failed with status code 404" when buying coins/tickets

This means the call to Paystack's API never reached a valid endpoint - almost always because
`PAYSTACK_SECRET_KEY` isn't a real key. Check, in order:

1. **Does `.env` actually exist** (not just `.env.example`)? `cp .env.example .env` if you skipped that step.
2. **Is `PAYSTACK_SECRET_KEY` still the placeholder** (`sk_test_xxxxxxxxxxxx`)? Replace it with your real
   test or live secret key from your Paystack dashboard.
3. Restart the server after editing `.env` - environment variables are only read on startup.

The app now checks this and throws a clear message (`PAYSTACK_SECRET_KEY is not set...` or `...still
the placeholder value...`) instead of a bare 404, and logs Paystack's actual error response body to
your terminal on any other failure - check there for the real reason if it's still unclear.

## 3d. Troubleshooting: "FOR UPDATE cannot be applied to the nullable side of an outer join"

This is a Postgres restriction, not an application bug in your data - it happens when a query tries
to `SELECT ... FOR UPDATE` (row locking) while also outer-joining another table, which is exactly
what Sequelize's `include` generates by default even for required foreign keys. Both `castVote`
(`services/voteService.js`) and `confirmTicketPurchase` (`services/ticketService.js`) hit this
originally and are already fixed: each locks only the row it actually needs to lock (Contestant,
Ticket), then looks up any related row (Edition, TicketTier) in a separate, unlocked query
afterward. If you add new locked queries anywhere, keep this pattern - never combine
`lock: t.LOCK.UPDATE` with `include` in the same query.

## 3e. Troubleshooting: "sh: 1: tailwindcss: not found" on Render (or similar hosts)

Render (and several other Node hosts) set `NODE_ENV=production` during the build step by default,
which makes `npm install` skip everything in `devDependencies` entirely. The `postinstall` hook
still tries to run `npm run build:css`, which needs the `tailwindcss` binary - if it's not installed,
that fails and takes the whole build down with it.

Already fixed in `package.json`: `tailwindcss`, `postcss`, and `autoprefixer` live in `dependencies`,
not `devDependencies`, specifically so they always install regardless of `NODE_ENV`. If you ever add
another build-time tool that a `postinstall`/`prestart` script depends on, keep it in `dependencies`
too, not `devDependencies` - `devDependencies` is only safe for things that never run as part of the
actual build or start command (test runners, `nodemon`, etc.).

## 4. Paystack webhook (required for coins/tickets to actually credit)

Bundle purchases and ticket purchases both redirect through Paystack checkout, but the **webhook** is
the source of truth that actually credits coins / activates tickets (the browser callback page is just
a friendly landing screen). In your Paystack dashboard, set the webhook URL to:

```
https://yourdomain.com/webhooks/paystack
```

For local testing, run `ngrok http 3000` (or whatever port you're on) and set the webhook URL in
your Paystack dashboard to the ngrok HTTPS URL + `/webhooks/paystack`, e.g.
`https://abcd1234.ngrok-free.app/webhooks/paystack`. Since ngrok URLs change on restart (unless
you're on a paid plan with a reserved domain), you'll need to update that URL in the Paystack
dashboard each time you restart ngrok.

- **Bundle purchases** are initialized with `split_code` from `PAYSTACK_VOTE_SPLIT_CODE` → your developer share is routed automatically on settlement.
- **Ticket purchases** are unsplit by default (full amount to your main account) — configurable via `.env`, see section 17.

**Test mode vs. live mode:** Paystack split payments only work with a live secret key
(`sk_live_...`) — they're not supported in test mode at all. The app detects your key's prefix
automatically (`utils/paystack.js`) and, if it's a test key (`sk_test_...`), silently drops the
split code so bundle purchases still go through as a normal (unsplit) transaction instead of
failing. A yellow banner on the Admin Dashboard confirms when this is happening, so it's never a
silent surprise. Switch `PAYSTACK_SECRET_KEY` to a live key when you're ready to go live and splits
will start applying automatically — no code changes needed.

## 5. Voting economics

- **1 coin = 1 vote = ₦200.** Coin balances map directly onto votes, so a wallet showing "40 coins" means 40 votes available — no mental conversion needed.
- Coin bundles are just convenience pack sizes (5 / 15 / 35 / 75 / 150 / 300 coins/votes) — **no bonus coins**, price is always `coins × ₦200`. Adjust sizes anytime in Admin → Coin Bundles.
- Votes cast during the voting window feed each contestant's public vote count/leaderboard. This is informal momentum toward the main event, not a strict qualifying cutoff — the admin panel is where you actually mark someone as an approved contestant, disqualify them, or crown a winner, independent of vote count.

## 6. Roles

- **voter** — default signup, can vote, buy coins, buy tickets, apply to be a contestant.
- **staff** — check-in only (`/staff/checkin`), no access to the admin dashboard. Promote a user to staff directly in the `users` table (`role = 'staff'`) until you build a staff-invite UI.
- **admin** — back office at `/admin`: approve applications, manage contestant photos/placement/status, editions, coin bundle catalog, event/tier creation, table management, staff accounts, and Door Entry Records. No revenue visibility.
- **superadmin** — everything admin has, plus Transactions/revenue figures (section 8) and full CRUD on contestants, events, and tickets (section 18) - editing/deleting the underlying records, not just managing their day-to-day state.

## 7. Ticket check-in flow

- QR code encodes the raw `ticketCode` (a UUID). The check-in screen (`/staff/checkin`) scans it via the device camera (html5-qrcode).
- Every ticket also gets a short human-readable **fallback code** (e.g. `CQ-7F3K9X`, ambiguous characters like `0/O/1/I` excluded) for manual entry when a QR won't scan.
- **Regular/VIP tickets**: scanning or entering the code admits immediately, same as a normal single-seat ticket.
- **Table tickets**: scanning pulls up the table's guest roster instead of admitting anyone. Staff confirm identity against a name already on that list and tap it to admit that one guest — see section 9 below for the full table flow.
- Multiple staff can check in for the same event simultaneously — Socket.io broadcasts each check-in to everyone on that event's check-in screen.
- **QR images are stored twice**: first as a local file (`qrImageUrl`, fast, no network dependency) at generation time, then uploaded to Cloudinary as a persistent copy (`qrImageCloudinaryUrl`) right after. This matters on hosts with an ephemeral filesystem (Render, Railway, Heroku, etc.) — anything written to disk gets wiped on every redeploy or restart, which would otherwise silently break every previously-issued ticket's QR image. The ticket view (`views/tickets/view.ejs`) always prefers the Cloudinary URL when present, falling back to the local path only if the Cloudinary upload hasn't happened yet or failed (e.g. Cloudinary env vars not configured) — a failed upload is logged but never blocks the ticket purchase itself, since the local file still works until the next deploy.

## 8. Winner charity blog & voting restriction

Only contestants in the **current** edition (`Edition.isCurrent = true`) can be voted on — this is
enforced in `services/voteService.js`, not just hidden in the UI, so it can't be bypassed by posting
directly to `/vote/:contestantId`.

Past winners get a dedicated charity outreach page instead of a vote button:
- Contestant photos now have a `category`: `profile` (shown on their normal detail page) or `outreach`
  (shown only on their blog page). Set this when uploading photos in Admin → Contestants.
- Each contestant has a `blogContent` field, editable from the same admin screen, only shown for
  contestants marked as a winner.
- The page lives at `/contestants/:slug/blog`, and the home page's "last year winner" card links
  there with a "Read More" button instead of linking to the votable detail page.
- Non-winner contestants from past editions still show a "Voting has closed" message rather than a
  vote form when viewed after their edition is no longer current.

## 9. Ticket tiers & table management

Tickets are no longer a single flat price per event — each event has one or more **tiers**,
configured in Admin → Events:

- **Regular** and **VIP** are single-seat tiers (`tierType: 'single'`) — buy, get a QR, done, same as before.
- **Table for 5** / **Table for 10** are `tierType: 'table'` — one purchase seats a group. The buyer
  becomes the table owner automatically and can name their guests afterward from **My Tickets → Manage Table**
  (`/tickets/my/:ticketId/manage`), up to the tier's seat count.

Demo pricing seeded: Regular ₦2,000, VIP ₦5,000, Table for 5 ₦18,000, Table for 10 ₦32,000 — all
editable (or add more tiers) in Admin → Events.

**Door-side identity check for tables:** staff check-in (`/staff/checkin`) is two steps for a table:
1. Scan the QR (or type the fallback code) — pulls up the table's registered guest roster instead of
   admitting anyone immediately.
2. Staff visually/verbally confirm the person matches a name already on that list, then tap that name
   to admit them. Nobody gets in on a table ticket just by showing up and claiming to belong to it —
   their name has to already be on the roster the owner registered, or staff can add a walk-up guest
   on the spot if a seat is still free (flagged `addedAtDoor` in the data for reporting).

Admin also has a dedicated **Table Management** screen (`/admin/tables`) showing every table sold,
its owner, its roster, and check-in progress (e.g. `3/5 checked in`), with the ability to add or
remove guests from the back office too.

## 10. Last edition's top three & the winner's blog

The home page now shows a small "podium" for the previous edition: Queen in the center (elevated),
flanked by 1st and 2nd Runner-up. Set these in Admin → Contestants via the placement dropdown
(No placement / Queen / 1st Runner-up / 2nd Runner-up) — only "Queen" sets `isWinner = true`.

- The **Queen's** card links to her charity outreach blog (`/contestants/:slug/blog`) via a Read More button.
- **Runner-up** cards link to their normal contestant profile page instead — since their edition is no
  longer current, that page shows a "Voting has closed" message rather than a vote form (see section 8).

## 11. Return-to destination: shared links, login/signup, and mid-vote top-ups

Shared contestant links work end-to-end, and it's backed by the **session**, not just a query
param, so it survives page reloads and switching between login/signup:

- Visiting a protected page while logged out (voting, buying a ticket, applying as a contestant,
  etc.) stashes that exact URL in `req.session.returnTo` via `requireAuth`/`requireRole`
  (`middleware/auth.js`, `utils/returnTo.js`), in addition to passing it as `?next=` for a
  human-readable URL. After login **or signup** - a brand-new visitor who registers instead of
  logging in still lands back on the same page - the session value wins and is cleared once used.
- Switching between the Login and Sign Up pages carries the destination along both ways, so someone
  who clicks "Log In to Vote," realizes they need an account, and hits "Create an account" doesn't
  lose their place.
- If a vote fails because the wallet doesn't have enough coins, the vote form posts a `returnTo`
  field. The person is sent to **Buy Coins** with that page remembered, the Paystack `callback_url`
  carries it through checkout, and after payment they land straight back on the contestant page
  (with a flash message) instead of the wallet dashboard.
- All of this goes through `utils/safeRedirect.js`, which only allows relative, same-site paths - a
  `next`/`return` value can never be used to redirect someone off-site.

## 12. Base URL detection (localhost / ngrok / live, automatically)

`utils/getBaseUrl.js` builds the URL used for Paystack's `callback_url` from the incoming request
itself rather than a fixed value, so the same code works unmodified whether you're on `localhost`,
tunneled through ngrok, or live:

- Leave `APP_URL=auto` in `.env` (the default) and it reads the request's actual protocol + host -
  this becomes `http://localhost:3000` locally, `https://abcd1234.ngrok-free.app` automatically when
  accessed through an ngrok tunnel, or your real domain in production behind a reverse proxy.
- `app.set('trust proxy', 1)` in `app.js` ensures `X-Forwarded-Proto` (which ngrok and most proxies
  set) is honored so the detected protocol is correct.
- Set `APP_URL` to an explicit value only if you want to force a fixed canonical domain regardless
  of request headers - that always takes priority over auto-detection.

This only affects the browser-side checkout redirect. The **webhook URL** is still something you
configure manually in your Paystack dashboard (see section 4) - it can't auto-detect itself since
Paystack calls it independently of any request context.

## 13. Transaction detail page

Every row in **Wallet → Transaction History** (and the equivalent admin **Transactions** table) is now
clickable and opens a detail page (`/dashboard/wallet/:id` for users, `/admin/transactions/:id` for
admin) showing the reference, amount/coins, status, and type-specific context: which bundle was
bought, which contestant a vote went to (with a link to their profile), or which ticket/event a
purchase was for (with a link to the ticket itself).

## 14. Real-time updates everywhere, admin/superadmin split, and folder-based gallery

**Live updates:**
- Every page showing a vote count (home page grids, the contestants list, contestant detail) now
  updates in real time automatically - no page-specific socket code needed per page, just a
  `data-vote-count="<contestantId>"` attribute; `public/js/main.js` handles joining the right rooms
  and patching the DOM from one shared handler.
- A single shared Socket.io connection (`window.appSocket`) is initialized in `views/layout.ejs`'s
  `<head>` (not at the bottom of the page) so it's guaranteed to exist before any inline page script
  further down tries to use it.
- **Ticket owners get notified live when their ticket is scanned** — the ticket-view page joins a
  private `ticket:<id>` room; the moment staff check it in (or a table guest on it), the page shows
  "Your ticket was just scanned! Please wait to receive your wristband before heading inside." and
  refreshes shortly after.
- **Admin dashboards get a live activity feed** for every meaningful action (votes, check-ins,
  new applications) via an `admin-feed` socket room. Superadmin dashboards additionally get a
  **Live Revenue** panel (`admin-feed-revenue` room) for purchases with money attached — a plain
  admin's dashboard never even joins that room, so revenue data never reaches it in real time either,
  not just in the page it renders.

**Admin vs. Superadmin:**
- **admin**: applications, contestants, editions, coin bundle catalog config, events/ticket tiers,
  table management, staff accounts, and the new **Door Entry Records** page (`/admin/door-entries`) —
  everything operational, no money figures anywhere.
- **superadmin**: everything an admin sees, plus **Transactions** (`/admin/transactions`, restricted
  via `requireRole('superadmin')` at the route level, not just hidden in a menu) and the **Total
  Revenue** stat on the dashboard.
- A new demo account, `manager@carnivalqueen.test` / `Password123!`, has the plain `admin` role so you
  can see the difference immediately next to `admin@carnivalqueen.test` (superadmin).

**Door Entry Records** (`/admin/door-entries`) is a unified scan log combining single-ticket
check-ins and individual table-guest check-ins into one chronological list, each row showing the
guest's name, event, tier, check-in method (QR / fallback code / table roster / walk-in), and —
critically — **which staff member checked them in** (`checkedInByStaffId` on both `Ticket` and
`TableMember`), so there's always an audit trail of who let someone in.

**Loading feedback:** every link click and form submission now shows a full-page loading overlay,
and submit buttons disable themselves with a spinner ("Processing...") the moment they're clicked -
prevents double-submits on payment/vote actions and gives clear feedback that something is happening.

**Gallery is folder-based, not database-driven:** drop image files (`.jpg`/`.jpeg`/`.png`/`.webp`)
directly into `public/gallery/` and they show up automatically, newest file first — no admin upload
flow, no database records. The home page shows a small preview (first 8), the Gallery page
(`/gallery`) shows all of them. Eight sample images are included so the demo isn't empty; replace or
add to them freely.

## 15. Email (Brevo), email verification, and password recovery

**Email delivery** goes through [Brevo](https://www.brevo.com)'s transactional email API
(`utils/email.js`, plain `axios` calls - no SMTP setup needed). Set `BREVO_API_KEY` in `.env` (get
one from your Brevo dashboard under Settings → SMTP & API → API Keys). Three branded HTML emails are
sent: account verification, password reset, and ticket delivery (with the QR code embedded when a
Cloudinary URL exists - see section 7).

**Graceful degradation on Brevo's free-plan cap:** every send goes through `sendEmail()`, which never
throws - it always returns `{ sent: true }` or `{ sent: false, reason }`. Hitting Brevo's daily send
limit (or any other outage) never blocks the underlying action:
- **Registration** still creates the account; the person just sees "we couldn't send the verification
  email right now - email service is currently unavailable" and can hit **Resend** once capacity frees up.
- **Ticket purchases** still complete and the ticket is fully usable in-app; `Ticket.ticketEmailSentAt`
  stays `null`, and the ticket page shows "email service is currently unavailable, so we couldn't email
  this ticket - but it's all right here" instead of silently leaving the person wondering where their
  email went.
- **Password reset requests** always show the same generic "if an account exists, instructions have
  been sent" message regardless of whether the account was found or the send succeeded - both for
  security (no email enumeration) and so an outage doesn't need special-casing in the UI.

**Email verification** is a hard gate, not just a banner: `middleware/auth.js`'s `requireVerifiedEmail`
sits behind `requireAuth` on every voter-facing action that matters (voting, buying coins, buying
tickets, managing a table, applying as a contestant, and the whole dashboard). An unverified user
hitting any of those is redirected to a **persisting screen** (`/auth/verify-email-notice`) that
doesn't let them past until they click the link in their email - with a **Resend** button and a logout
option. The original destination they were headed to is preserved in session (same mechanism as
section 11) and resumes automatically the moment they verify. Seeded demo accounts have
`emailVerifiedAt` pre-set so this only affects real signups going forward, not the demo data.

**Password recovery**: `/auth/forgot-password` → email with a 1-hour token → `/auth/reset-password`.
Tokens are single-use (cleared on success) and expiry-checked server-side on both the page load and
the actual submission, not just at generation time.

## 16. Staff scan history & dashboard, and event-mismatch protection

- **Scanning now checks the ticket belongs to the event currently selected** on the check-in screen
  (`services/ticketService.js`'s `scanTicket`) - staff working Event B who scan a ticket for Event A
  get a clear "This ticket is not for this event. It belongs to '<event name>'." instead of silently
  admitting the wrong crowd.
- **Every staff member has their own scan history** (`/staff/history`) - every check-in they've
  personally performed, single tickets and table guests together, newest first.
- **A personal dashboard** (`/staff/dashboard`) shows their check-ins today vs. all-time, plus their 8
  most recent scans, with a link to the full history.
- Both reuse a shared query builder (`utils/doorEntries.js`) also used by the admin-wide **Door Entry
  Records** page (section 14) - pass a `staffId` to scope it to one person, omit it for the full log.
- The check-in screen (`/staff/checkin`) now has quick links to both in its header.

## 17. Home page Theme section, navbar logo, ticket check icon, and configurable ticket splits

**Theme section**: the home page now has a 2-column section (image one side, text the other) showing
the current edition's theme - title, description, and an image, all editable per-edition in
Admin → Editions → "Home Page Theme Section" (upload an image, write the title/description, save).
Only shows if a theme title or description is set on the current edition.

**Navbar logo**: `views/partials/navbar.ejs` now renders `/public/img/logo.png` instead of an icon +
text wordmark. A placeholder crown-and-wordmark logo (white text, sized for the dark green navbar) is
included so the site isn't broken out of the box - swap that file for your real logo whenever it's ready.

**Ticket check icon**: once a ticket flips to `used` (checked in at the door), the ticket-view page
replaces the QR code with a large green checkmark and "Checked in at [time]" instead of continuing to
show a QR that no longer needs scanning. This combines with the existing live-update socket
(`ticket:status_update` from section 14) - the moment staff scan it, the owner's page announces it,
waits briefly, and reloads showing the checkmark automatically, no manual refresh needed.

**Configurable ticket revenue splitting**: ticket purchases are unsplit by default (matches the
original spec), but this is now a `.env` toggle instead of hardcoded - set
`PAYSTACK_TICKET_SPLIT_ENABLED=true` and give `PAYSTACK_TICKET_SPLIT_CODE` a value whenever you want
ticket sales split too; leave the flag `false` (or unset) for normal full-amount ticket purchases.
This is independent of `PAYSTACK_VOTE_SPLIT_CODE`, which continues to always apply to coin bundle
purchases regardless of this setting.

## 18. Superadmin CRUD: contestants, events, tickets

On top of what regular `admin` already handles (applications, image uploads, placements, status,
tier toggling, table management), `superadmin` gets full create/edit/delete on the underlying
records themselves - gated with `requireRole('superadmin')` at the route level, not just hidden
buttons:

- **Contestants** (`/admin/contestants/new`, `/admin/contestants/:id/edit`) - add a contestant
  directly without requiring an application, edit their core details (name, edition, number, state,
  age, occupation, bio, tagline, Instagram), or delete one outright. Deleting cascades to their
  photos and vote history (FK `CASCADE`) - there's no undo, so the form has a confirm dialog.
- **Events** (inline "Edit Event" toggle on `/admin/events`) - edit an event's name, venue, date,
  capacity, description, and active status after creation, or delete it entirely. Deleting an event
  cascades to its ticket tiers and every ticket sold against it (FK `CASCADE`) - transaction records
  survive with their `ticketId` set to `null` so revenue history isn't lost. Ticket tiers themselves
  also get full edit/delete (price, seats, name, availability), not just the existing activate/deactivate.
- **Tickets** (`/admin/tickets`) - browse every ticket ever sold or issued, edit a ticket's holder
  name or status directly, or delete one. The standout capability here is **issuing a ticket
  manually** (`/admin/tickets/new`) - no Paystack involved, no charge (`priceNaira: 0`, logged as a
  `comp` transaction) - for press, VIP guests, or comps. It generates a real QR code and Cloudinary
  upload exactly like a paid ticket, finds-or-creates the recipient's account by email (auto-created
  accounts are pre-verified, skipping the email verification wall since an admin vouched for them
  directly), and attempts to email it to them the same way a normal purchase does.

## 19. What's scaffolded vs. what to extend

Everything listed in the original spec has working models, routes, and views: home (this year + last
year), about, contact, gallery, contestant list/detail with multi-photo galleries, live leaderboard,
registration with document uploads, wallet + coin bundles + Paystack (split code), voting (quick + manual,
real-time via sockets), ticketing (Paystack, no split, QR + fallback code, staff check-in), user dashboard
(balance, transaction history, voting history, profile), admin panel, and mobile bottom navigation.

Reasonable next steps as you harden this for production:
- Add rate-limiting/CAPTCHA on voting and auth routes.
- Add email notifications (Nodemailer is already a dependency) for application approval/rejection and ticket receipts.
- Move the placeholder contestant images out once Cloudinary is wired up.
- Add a proper "create staff" form in the admin panel instead of editing the DB directly.
- Consider a background job (e.g. `node-cron`) to auto-flip `Edition.isCurrent` based on `votingOpensAt`/`votingClosesAt`.
