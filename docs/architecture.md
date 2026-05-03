# Architecture Notes

## Phase split

1. Phase 1: Next.js web platform and Firebase backend
2. Phase 2: Flutter agent app consuming the same API contracts and storage paths
3. Phase 3: Expanded admin workflows and analytics

## Service boundaries

- `src/modules/*/repository.ts`: Firebase-specific reads and writes
- `src/modules/*/service.ts`: validation and orchestration
- `src/app/api/*`: HTTP surface for web and future mobile clients
- `src/lib/types.ts`: shared DTOs that map cleanly to future PostgreSQL tables

## Migration path to Node.js and PostgreSQL

- Keep route handlers thin so they can move into an Express or Fastify service later.
- Replace repository implementations first, keeping service and DTO contracts stable.
- Preserve pagination via cursor tokens at the API boundary.
- Keep Storage paths stable so mobile and web clients do not need to change on backend migration.

## Flutter app guidance

- Reuse `/api/agents/me`, `/api/listings`, and admin endpoints as the contract surface.
- Keep upload compression client-side before hitting Firebase Storage.
- Cache listing cards locally and paginate aggressively for unstable networks.
- Use the same role model: Firebase Auth plus server-verified authorization.
