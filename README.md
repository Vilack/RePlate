# RePlate — Cloud-Based Food Waste Risk Prediction and Redistribution

RePlate connects food donors, NGOs/food banks, and delivery volunteers. Donors publish surplus food, NGOs request available listings, donors approve or reject requests, volunteers claim approved deliveries and record handover, and the system records impact metrics. A transparent expiry-time rules engine prioritizes listings that need attention.

## FT-III assessment mapping (10 marks)

- **Problem analysis and cloud design (2):** React SPA hosted on a static web host; Supabase managed PostgreSQL, Auth, and Row Level Security; role-based donor/NGO/volunteer workflows.
- **Implementation and technical execution (4):** authenticated user profiles, food CRUD, request lifecycle, delivery lifecycle, expiry-risk indicators, database triggers, RLS, impact dashboard, CSV export.
- **Results and technical evaluation (2):** use the test checklist below to measure real workflow success, query/response times, policy outcomes, and impact-record behavior. Do not fabricate measurements.
- **Viva (2):** short viva answers are in `docs/FT3_REPORT_AND_VIVA.md`.

## Technology stack

- React 19 + Vite + React Router
- CSS (responsive UI) + Lucide icons
- Supabase Auth + PostgreSQL + RLS
- PostgreSQL triggers for profile bootstrap, request approval, delivery validation, and impact recording
- CSV export from the Impact page

The waste-risk module is a **rule-based estimate**, not a trained ML model. It classifies unfulfilled food listings by remaining time: high risk at 6 hours or less, medium risk up to 24 hours, and low risk beyond 24 hours. It is not a food-safety certification.

## Setup

### 1. Prerequisites

- Node.js 20.19+ or 22.12+ and npm (Vite 8 requirement)
- A Supabase project

### 2. Configure Supabase

1. Open the Supabase SQL Editor.
2. Run `database/schema.sql` first **only if creating a new project/database schema**.
3. Run `database/ft3_migration.sql` after the schema. The migration enables RLS, adds role/profile creation, protects request/delivery transitions, and creates impact records. Review and test it in a development project before using real data.
4. In `frontend`, copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project API settings.
5. In Supabase Authentication settings, configure the local redirect URL (for example `http://localhost:5173`) and your deployed site's URL. If email confirmation is enabled, users must confirm their email before sign-in.

**Never use the Supabase `service_role` key in the browser.** The publishable/anon key is intended for frontend use with correct RLS policies.

### 3. Run locally

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). Check production compilation with:

```bash
npm run build
npm run preview
```

### 4. Deploy

Deploy the `frontend` directory to a static frontend host such as Vercel or Netlify. Add the two `VITE_SUPABASE_*` environment variables in the host settings and configure the Supabase Auth site/redirect URLs for the deployed domain. Rebuild after changing environment variables.

## Main workflows

1. Register as a food donor/provider, NGO, or volunteer.
2. Provider publishes a listing with category, quantity, expiry time, and pickup details.
3. NGO browses unexpired available food and requests a listing.
4. Provider approves/rejects the request. Approval reserves the listing and creates a delivery record in the database.
5. Volunteer claims an unassigned delivery, then records `picked_up` → `in_transit` → `delivered`.
6. Delivery completion marks the listing delivered and creates an impact record.
7. Dashboard shows accessible listings and workflow counts; Impact displays records and exports CSV.

## Prediction and impact assumptions

- Expiry risk is computed in the browser from `expiry_time` and listing status. Thresholds are configurable in `frontend/src/lib/foodLogic.js`.
- `food_saved_kg` is populated only when the listing quantity unit is `kg`; other units are not silently converted to kilograms.
- The migration uses **0.4 kg per meal** as a classroom demonstration assumption for kilogram listings. For `items`, each item is counted as one estimated meal. Other units yield zero estimated meals until a defensible conversion is defined.
- The migration uses **2.5 kg CO₂-equivalent per kg of food saved** as an illustrative assumption, not a verified emissions factor. Clearly label it as an estimate in the report, or replace it with a cited factor appropriate to the food type and region.
- Impact is recorded once per listing because `impact_records.listing_id` is unique and the current UI requests the full listed quantity. Partial fulfillment/multiple recipients would need a different impact schema before production use.

## Security model

- Supabase Auth identifies users.
- The database trigger creates a profile, a non-admin role, and the matching role-specific profile.
- RLS restricts profile data to its owner, listing changes to the provider, requests to the requesting NGO and listing owner, deliveries to the involved parties, and notifications to their owner.
- Request and delivery transition triggers reject changes outside the intended state machine.
- New users cannot self-register as `admin` through the frontend role selector or Auth metadata trigger.

Before public deployment, independently test every RLS policy with separate provider, NGO, and volunteer accounts. The SQL is an academic project baseline, not a substitute for a formal security review.

## Troubleshooting

- **Missing Supabase URL/key:** ensure `frontend/.env` exists and contains the two Vite variables, then restart Vite.
- **Registration succeeds but sign-in is blocked:** confirm the email if confirmation is enabled.
- **Food listing creation says provider profile is missing:** confirm the migration ran after the schema; for older accounts, the migration includes a profile/role backfill. Sign out and sign in again after migration.
- **RLS/access denied:** inspect the SQL migration and confirm the user has the correct role in `user_roles` and the matching profile table.
- **Approval fails because listing is unavailable:** another request may have reserved it or the listing may have expired; refresh and choose an available listing.
- **Build fails:** run `npm install` using a supported Node.js version and share the complete error output. Do not copy `node_modules` from another operating system.

## Files

- `database/schema.sql` — original relational schema
- `database/ft3_migration.sql` — FT-III profile, RLS, lifecycle, and impact additions
- `frontend/src/pages/` — React pages
- `frontend/src/components/AppShell.jsx` — shared signed-in navigation and layout
- `frontend/src/lib/foodLogic.js` — expiry risk and formatting helpers
- `docs/FT3_REPORT_AND_VIVA.md` — report outline, architecture, test plan, and viva notes
