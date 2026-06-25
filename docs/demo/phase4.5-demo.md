# Phase 4.5 Demo — Notifications Domain

**Phase**: 4.5  
**Deliverable**: In-app inbox, notification preferences, OTP/2FA, inbound webhooks, admin marketing campaigns.  
**Backwards compatible with**: Phase 1 (`GET /api/health`, `GET /api/v1/me`), Phases 2–4.

```bash
./scripts/phase4.5-demo.sh          # automated gate
bun run demo:phase4.5               # same
```

---

## Phase 4.5 deliverables checklist

| # | Deliverable | Location | Verified by |
| - | ----------- | -------- | ----------- |
| 1 | In-app inbox REST | `src/api/src/domains/notifications/` | E2E + integration |
| 2 | Preferences GET/PATCH | `NotificationsController` | E2E + FE `/seeker/privacy` |
| 3 | OTP + 2FA auth paths | `OtpService`, auth controller | Unit + E2E |
| 4 | Twilio + Resend webhooks | `WebhooksController` | Integration |
| 5 | Admin campaigns | `CampaignService` | Integration + `/admin/campaigns` |
| 6 | Notification worker | `NotificationWorker` | Unit + integration |
| 7 | **FE-4.5** inbox + preferences | `seeker.notifications`, `api-client` | Demo script + browser |
| 8 | Diagnostics panel | `/dev/diagnostics` | `data-testid="notifications-diagnostics-panel"` |

**Test coverage**: global ≥ 90% (`bun run api:test:cov`).

---

## Prerequisites

```bash
bun run setup:env
docker compose up -d postgres redis
bun run api:migrate:dev
bun run api:dev    # :3001
bun run dev        # :8080
```

| Variable | Purpose |
| -------- | ------- |
| `JWT_SECRET` | Auth tokens |
| `REDIS_URL` | BullMQ notification queue |
| `RESEND_API_KEY` | Email (dev console fallback) |
| `TWILIO_*` | SMS + webhook signature validation |
| `VITE_API_BASE_URL` | Frontend → Nest API |

---

## Part A — Postman (notifications + webhooks)

1. Import `src/api/postman/warehousejobs.postman_collection.json`
2. Run **Auth → Login** to populate `accessToken`
3. **Notifications → List inbox** — `GET /api/v1/notifications`
4. **Notifications → Update preferences** — `PATCH /api/v1/notifications/preferences`
5. **Webhooks → Twilio SMS** (fixture signature in integration tests)
6. **Admin → Create campaign** + **Send campaign**

Swagger UI: `http://localhost:3001/api/docs`

---

## Part B — Browser (FE-4.5)

1. Sign in at `/auth` (Nest JWT stored in localStorage)
2. Open **Seeker → Notifications** (`/seeker/notifications`) — inbox from Nest API
3. Open **Seeker → Privacy** — toggle notification preferences (`data-testid="notification-preferences"`)
4. **Admin → Campaigns** (`/admin/campaigns`) — create draft + send
5. **Dev diagnostics** (`/dev/diagnostics`) — notifications sync panel (`data-testid="notifications-diagnostics-panel"`)

### MFA login (vendor/admin with 2FA enabled)

1. Sign in with MFA-enabled account
2. When prompted, enter OTP code on the verification step
3. Session completes via `POST /api/v1/auth/verify-2fa`

---

## Part C — Automated gate

```bash
./scripts/phase4.5-demo.sh --live
```

Includes Phase 1 health smoke, full test pyramid, OpenAPI validation, contract drift guard, and frontend build.

---

## Notes

- WebSocket push uses an in-process gateway for tests; production Socket.IO namespace `/notifications` is documented in `notification.gateway.ts`. The frontend uses **5s poll sync** until HTTP upgrade is enabled.
- Marketing SMS/email respects `marketing_consents` and `sms_opt_outs` (TCPA STOP handling via Twilio webhook).
