# PlateView — Supabase Production Backend Edition

This version replaces browser-only IndexedDB/localStorage as the source of truth.

## What is real now

- Email/password restaurant accounts with Supabase Auth
- Multiple restaurants per account
- PostgreSQL persistence for restaurants and menu items
- Cloud Storage for `.glb` models and dish photos
- Row Level Security so owners can only modify their own restaurants
- Public read-only digital menus for published restaurants
- Server-backed menu/dish/AR analytics
- QR codes that point to the published restaurant slug
- EN / NL / FR menu content
- No ordering, checkout, payment, or Stripe functionality

## 1. Create a Supabase project

Create a project in Supabase.

In the Supabase SQL editor, run:

    supabase/schema.sql

That creates the database tables, RLS policies, indexes, analytics table, and public `menu-assets` Storage bucket. The schema is safe to run again if an earlier attempt stopped partway through.

## 2. Configure the frontend

Open `config.js` and replace:

    YOUR_SUPABASE_PROJECT_URL
    YOUR_SUPABASE_PUBLISHABLE_KEY

with the Project URL and publishable key from your Supabase project.

Do NOT put a service-role key in browser code.

## 3. Authentication settings

For the easiest test, you can temporarily disable mandatory email confirmation in Supabase Auth settings.

For production, keep email confirmation enabled and configure:
- Site URL
- Redirect URLs
- Custom SMTP / email templates if desired

## 4. Run locally

Use a local web server:

    python -m http.server 8080

Open:

    http://localhost:8080/dashboard.html

Sign up, create a restaurant, add dishes, upload GLB models, and publish.

Your public menu will be:

    http://localhost:8080/index.html?r=YOUR-RESTAURANT-SLUG

## 5. Deploy

Deploy the static frontend folder to any HTTPS host such as Vercel, Netlify, Cloudflare Pages, GitHub Pages, or your own web server.

AR camera functionality should be tested over HTTPS on a compatible mobile device.

## Security model

The browser uses only the Supabase publishable key. Authorization is enforced in PostgreSQL Row Level Security.

Each restaurant has an `owner_id`. Policies allow an authenticated user to create/read/update/delete only restaurant rows whose `owner_id` matches their `auth.uid()`.

Menu items inherit access through their restaurant.

Storage uploads use this path format:

    USER_UUID / RESTAURANT_UUID / models|photos / RANDOM_FILENAME

Storage policies restrict writes to the logged-in user's own top-level UID folder.

Public menu queries can only see restaurants where `published = true` and menu items where `published = true`.

## Important production notes

This is now a functional cloud-backed multi-tenant foundation, but before selling it to restaurants you should still add:

- password reset / email verification UI
- rate limiting / anti-bot protection for anonymous analytics
- asset deletion when a menu item is deleted
- model compression / size validation
- usage limits by plan
- custom domains
- backups / monitoring
- legal/privacy/cookie copy appropriate for your deployment
- accessibility and device QA
- optional staff/team roles if several employees must edit one restaurant

## Files

- `dashboard.html` — owner dashboard
- `index.html` — public digital menu
- `config.js` — your Supabase connection settings
- `shared.js` — Supabase data/auth/storage layer
- `dashboard.js` — owner CRUD/auth/upload UI logic
- `app.js` — public menu + 3D/AR logic
- `supabase/schema.sql` — database, RLS, analytics, Storage policies


## Real-size AR workflow

For each dish, enter **Real dish width (cm)** in the dashboard. PlateView reads the GLB model bounds in the browser and applies a uniform scale so the AR placement is approximately the entered physical width. AR scaling is locked (`ar-scale="fixed"`) so guests do not accidentally resize the food.

For phone AR, deploy PlateView to an HTTPS URL. A QR generated while the dashboard runs on `localhost` is only suitable for layout testing because `localhost` on a phone refers to the phone itself. Once PlateView is deployed, the QR generator automatically uses the deployed origin.

Recommended test: publish restaurant → set a dish width → deploy over HTTPS → generate QR → scan with phone → open dish → **Open camera AR** → move phone over table → place dish.
