# PlateView SaaS setup

This version turns PlateView into a subscription-based multi-restaurant SaaS.

## What is already implemented

- Public PlateView sales/landing page (`index.html`)
- Pricing page (`pricing.html`)
- Restaurant owner signup/login (`auth.html`)
- Stripe Checkout subscription creation (`/api/create-checkout-session`)
- Stripe webhook subscription syncing (`/api/stripe-webhook`)
- Subscription-gated restaurant dashboard (`dashboard.html`)
- Stripe customer billing portal (`/api/create-portal-session`)
- Five-step restaurant onboarding (`onboarding.html`)
- Existing 3D/AR guest menu moved to `menu.html`
- Old QR links that still use `index.html?r=...` are automatically redirected, so previously printed QR codes keep working
- Starter plan limit: 1 restaurant
- Pro plan limit: up to 5 restaurants
- Owner data separation through Supabase RLS
- PlateView admin control center (`admin.html`)
- Admin suspend/restore account control
- Admin MRR, subscriptions, restaurants and menu-view totals

## 1. Upload this project to GitHub

Use the same GitHub repository and the same Vercel Root Directory you already use.

Do not replace your working `config.js` with the placeholder version from a full ZIP. Keep your existing browser-safe Supabase Project URL and publishable key.

## 2. Run the Supabase SaaS upgrade

In Supabase:

1. Open **SQL Editor**.
2. Open `supabase/saas-upgrade.sql` from this project.
3. Paste the entire file into the SQL Editor.
4. Click **Run**.

This creates `profiles` and `subscriptions`, adds subscription RLS rules, and keeps users who existed before the upgrade on `legacy` access so your current PlateView account is not locked out.

For a completely new Supabase project, use `supabase/full-schema.sql` instead.

## 3. Make your own account the PlateView admin

After the SaaS SQL succeeds, run this separately in Supabase SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL_ADDRESS';
```

Only your PlateView owner account should be `admin`. Restaurant customers stay `customer`.

## 4. Create Stripe products and monthly recurring prices

Start in Stripe Test mode.

Create two recurring monthly products/prices:

- PlateView Starter — EUR 39/month
- PlateView Pro — EUR 69/month

Copy each generated Stripe Price ID. They look similar to `price_...`.

The displayed prices are ordinary frontend text, while the actual amount charged is controlled by the Stripe Price IDs. If you later change commercial pricing, create/change the Stripe Prices and update the marketing text.

## 5. Add server environment variables in Vercel

Open the PlateView project in Vercel → **Settings → Environment Variables**.

Add these variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
SITE_URL=https://plateview-cyan.vercel.app
```

Important:

- `SUPABASE_SECRET_KEY` is a server secret. Never put it in `config.js` or GitHub.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` also belong only in Vercel environment variables.
- Keep your current browser `config.js` using only the Supabase publishable key.

After adding/changing environment variables, redeploy the Vercel project.

## 6. Create the Stripe webhook

In Stripe, add a webhook endpoint:

```text
https://plateview-cyan.vercel.app/api/stripe-webhook
```

Subscribe to at least:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
```

Stripe gives the webhook a signing secret beginning with `whsec_`. Put that value in Vercel as `STRIPE_WEBHOOK_SECRET`.

Redeploy after adding it.

## 7. Configure the Stripe customer portal

Enable/configure the Stripe Customer Portal so restaurant owners can:

- update payment method
- see invoices
- cancel the subscription
- change plans, if you want to allow it

The PlateView dashboard's **Billing → Manage billing** button opens this Stripe-hosted portal.

## 8. Keep Supabase Auth redirects configured

Your existing Supabase Authentication URL configuration should include:

```text
Site URL:
https://plateview-cyan.vercel.app

Redirect URL:
https://plateview-cyan.vercel.app/**
```

That also allows signup confirmation links to return to the PlateView login page.

## 9. Test the complete purchase flow in Stripe Test mode

Use a fresh email address so you test the exact customer experience:

1. Open the PlateView landing page.
2. Click Pricing.
3. Select Starter or Pro.
4. Create the restaurant-owner account.
5. If email confirmation is enabled, confirm the email and sign in.
6. Continue to Stripe Checkout.
7. Use a Stripe test card.
8. Checkout returns to the PlateView onboarding wizard.
9. Create restaurant → branding → first dish → tables → publish.
10. Open the dashboard.
11. Open Billing and verify the plan/status.
12. Open QR & Tables and scan a table QR with a phone.
13. Open a dish and test camera AR.

## 10. Test subscription cancellation

In Stripe Test mode:

1. Open the restaurant account's Billing page.
2. Open Manage billing.
3. Cancel the subscription.
4. Trigger/allow Stripe to send the subscription webhook.
5. Refresh `dashboard.html`.

When Stripe marks the subscription as no longer active, the dashboard is locked and the public guest menu stops serving through Supabase RLS. Restaurant data is retained instead of being deleted. A cancellation scheduled for period end remains active until Stripe actually ends it.

## 11. Admin area

After your profile role is `admin`, open:

```text
https://plateview-cyan.vercel.app/admin.html
```

or, with the Vercel rewrite:

```text
https://plateview-cyan.vercel.app/admin
```

The admin panel shows customer accounts, restaurant count, subscription states, estimated MRR from Stripe price data, menu views, and suspend/restore controls.

## 12. Going live

When Test mode works end-to-end:

1. Create/activate the matching Stripe products/prices in Live mode.
2. Replace Vercel's `STRIPE_SECRET_KEY` with the Live secret key.
3. Replace the Starter/Pro Price IDs with Live Price IDs.
4. Create a Live-mode Stripe webhook and replace `STRIPE_WEBHOOK_SECRET`.
5. Redeploy.
6. Make one small real purchase/refund test before selling broadly.

## File map

```text
index.html              sales website
pricing.html            subscription plans
auth.html/auth.js       owner signup and login
onboarding.html/js      post-purchase setup wizard
dashboard.html/js       restaurant owner app
menu.html/app.js        guest 3D & AR menu
admin.html/js           PlateView admin control center
api/                    Stripe + admin server endpoints
server/                  server-only helpers
supabase/saas-upgrade.sql existing-project upgrade
supabase/full-schema.sql  new-project setup
```
