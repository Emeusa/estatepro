# EstatePro

Lightweight real estate listing platform for mobile-dominant users in Nigeria and Africa.

## Stack

- Next.js App Router for the public listing website and internal dashboards
- Firebase Authentication, Firestore, Storage, and Admin SDK
- Modular service layer for easier migration to Node.js and PostgreSQL later

## MVP included

- Public listing discovery with filters and cursor pagination
- Agent registration and login pages
- Agent dashboard for listing CRUD and subscription state
- Admin moderation views for agents and listings
- Firestore indexes, Firestore rules, and Storage rules

## Quick start

1. Copy `.env.example` to `.env.local`
2. Add Firebase web app keys and admin service account credentials
3. Install dependencies with `npm install`
4. Run `npm run dev`

## Structure

- `src/app`: pages and API routes
- `src/components`: UI building blocks
- `src/modules`: schemas, repositories, and services
- `src/lib`: shared infrastructure and helpers
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`: backend security and performance config

## Notes

- Verification documents are private in Storage and only accessible to admins or the owning agent.
- All listing and agent mutations pass through validation in the API layer.
- The service and repository split keeps Firebase-specific code isolated.
