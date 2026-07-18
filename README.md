# SkyVayu — Charter Flight Booking Platform

SkyVayu is a full-stack private charter flight booking platform built as a monolith web app. It connects passengers with DGCA-licensed Non-Scheduled Operator Permit (NSOP) operators across India.

## Live Site

[www.skyvayu.com](https://www.skyvayu.com)

## Features

- **Instant Quotes** — Passengers submit a flight request; licensed operators respond with tailored quotes
- **OTP Authentication** — Phone-number-based login via Supabase Auth (SMS OTP)
- **Google OAuth** — Social login support
- **Operator Portal** — Dedicated portal for operators to manage quotes, bookings, and company profile
- **Admin Dashboard** — Internal admin panel for platform management
- **Payment Flow** — Two-step payment confirmation
- **Real-time updates** — Booking status synced live

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JavaScript |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Hosting | Vercel |
| Edge Functions | Supabase Edge Functions (Deno/TypeScript) |
| Fonts | Google Fonts (Manrope) |

## Project Structure

```
/
├── index.html          # Homepage / booking search
├── results.html        # Quote results
├── payment.html        # Payment step 1
├── payment2.html       # Payment step 2
├── confirmed.html      # Booking confirmation
├── profile.html        # User profile & bookings
├── admin/              # Admin dashboard
├── operator/           # Operator portal
├── js/                 # Shared JS modules (auth, results, otp, etc.)
├── css/                # Global stylesheets
├── supabase/functions/ # Serverless edge functions
└── vercel.json         # Hosting config & security headers
```

## Security

- Row Level Security (RLS) enforced on all public tables
- Content-Security-Policy, X-Frame-Options, and Permissions-Policy headers via Vercel
- Session storage for auth tokens (not localStorage)
- Auth guards on all protected pages

## Development

This is a static-file monolith — no build step required. Open any HTML file in a browser or deploy to Vercel.

## License

All rights reserved. © SkyVayu 2026
