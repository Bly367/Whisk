# Import function verification

The import functions keep gateway JWT verification disabled because modern
Supabase publishable keys are not JWTs. Each request must send both:

- `apikey: <project publishable key>`
- `Authorization: Bearer <signed-in user's access token>`

The function verifies the access token with Supabase Auth before doing any
import work. Never use a secret/service-role key in the Expo client.

After applying `002_import_usage.sql` in a non-production environment:

1. Call either function without `Authorization`; expect HTTP `401` and
   `code: "authentication_required"`.
2. Call it with an expired or malformed access token; expect the same `401`.
3. Call it with a current user access token and valid input; expect HTTP `200`.
4. Confirm the user's UTC-day row in `import_daily_usage` increments once and
   the corresponding `import_events` row is `succeeded`, with no recipe text,
   HTML, caption, token, image, or arbitrary payload column.
5. Force an upstream failure; confirm the event is `failed` with an HTTP status,
   stable error code, and duration.
6. Reach 20 accepted imports for that user on the same UTC day; the next valid
   request must return HTTP `429`, `code: "daily_quota_exceeded"`, and
   `retryAt`. Confirm the event is `rate_limited` and the usage count stays 20.
7. Using an `anon` or `authenticated` database session, verify direct inserts
   and all three usage RPCs are denied.

Do not paste credentials or real recipe/image content into test logs.
