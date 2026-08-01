# Live Gold Price Edge Function Deployment Guide

Follow these steps to deploy the `fetch-gold-price` Edge Function and connect it to your Supabase project.

## Step 1: Install Supabase CLI & Authenticate

```bash
# Login to Supabase CLI
supabase login

# Link your project
cd HPT_Trading_Tracker
supabase link --project-ref <your-project-ref>
```

## Step 2: Set GoldAPI Secret

Obtain a free API key from [https://www.goldapi.io/](https://www.goldapi.io/) and set it as an environment secret:

```bash
supabase secrets set GOLDAPI_KEY=goldapi-your-api-key-here
```

## Step 3: Deploy Edge Function

```bash
supabase functions deploy fetch-gold-price
```

## Step 4: Test Edge Function Manually

```bash
curl -X POST \
  "https://<your-project-ref>.functions.supabase.co/fetch-gold-price" \
  -H "Authorization: Bearer <your-anon-or-service-role-key>"
```

Expected Response:
```json
{
  "ok": true,
  "symbol": "XAUUSD",
  "price": 2432.5,
  "spread": 0.25,
  "volatility": "Elevated",
  "source": "goldapi",
  "is_fallback": false,
  "warning": null,
  "captured_at": "2026-08-01T22:30:00.000Z"
}
```

## Step 5: Execute SQL Cron Setup

Open your **Supabase SQL Editor** and execute the contents of `supabase/cron_setup.sql` to configure Supabase Vault, `pg_cron`, and `pg_net` for automatic 5-minute updates.
