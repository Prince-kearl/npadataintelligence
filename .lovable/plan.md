## NPA Phase 2 — Full Implementation Plan

Large scope. I'll execute in 4 sequenced batches so each is reviewable and the app stays buildable between them.

### Batch 1 — Database foundation (single migration)
Schema changes that unblock everything else:

- **Incidents**
  - Add `severity` enum (`low | medium | high | critical`)
  - Replace `status` with lifecycle enum: `draft | submitted | under_review | returned | verified | closed | archived`
  - Add `previous_channel` (text) — flag for incidents reported via other channels
  - Add `verification_score` (int) + `verification_notes` (text) — store duplicate-check result at submit
- **incident_attachments** (new table) — replaces ad-hoc storage uploads; supports multiple files per incident, tags (text[]), version (int), uploaded_by, scan_status (`pending|clean|infected|skipped`)
- **audit_logs** — add `old_values jsonb`, `new_values jsonb`, `ip_address inet`, `user_agent text`. Update `audit_incident_change` trigger to capture old/new diffs.
- **auth_events** (new table) — failed/successful logins, IP, user-agent
- **export_history** (new table) — user_id, format, row_count, filters_json, file_name, ip
- **query_templates** (new table) — saved SQL/filter templates with name, description, definition jsonb, owner, is_shared
- **incident_status_history** (new table) — every status transition with actor, from, to, note
- All new tables: GRANTs, RLS, indexes

### Batch 2 — Backend logic & integrations
- **Edge function `log-auth-event`** — called on login attempt to capture IP + UA
- **Edge function `notify-incident`** — triggered on insert/status change; sends emails for severity ≥ High and on status transitions. Uses Lovable Emails (scaffold transactional + auth templates if not present).
- **Edge function `daily-executive-summary`** — pg_cron daily; queues exec summary email to admins/analysts
- **Edge function `scan-attachment`** — stub virus scan (marks `clean` after basic MIME/size checks; real AV integration left as TODO comment)
- DB trigger: `incidents` status change → row in `incident_status_history` + invoke `notify-incident`

### Batch 3 — Frontend: data & forms
- **SubmitIncident**: severity selector; "previously reported via" source field; multi-file evidence uploader with tag chips, preview thumbnails, version label; auto-save draft to localStorage every 10s + restore prompt; camera capture (`<input capture>`); large touch targets (min 48px); offline draft queue (IndexedDB via `idb-keyval`) that flushes on reconnect.
- **Duplicate engine** (`incident-verification.ts`): add GPS haversine matching (<500m bonus), facility name fuzzy match, "previous channel" check; persist score to incident on submit.
- **Records**: advanced filter bar — Region, District, Product type, Category, Severity, Date range, Status, Reporter; URL-synced query params; lifecycle status transitions (with permission gates: Collector→submit, Analyst→under_review/returned/verified, Admin→closed/archived).
- **Evidence viewer modal**: image/PDF preview, version list, tag editor, signed-URL download, scan-status badge.

### Batch 4 — Frontend: analytics, GIS, reports
- **Dashboard**: KPI cards drill into filtered Records; severity distribution donut; top-5 recurring causes (grouped by category+product); period comparison (this 30d vs prev 30d) with delta arrows; interactive Recharts tooltips.
- **Analytics**: time-series with brush selector; severity stacked bars; region heat grid.
- **GIS Heatmap** (Leaflet): replace `HotspotMap` placeholder with react-leaflet + leaflet.heat; toggles for Hotspots / Districts / Regional trends; popup per incident.
- **Reports**: query templates (save/load filter combos); export-history table sourced from `export_history`; "Snapshot" button creates timestamped CSV+SQL pair in Storage; scheduled-backup config panel (writes pg_cron job through migration — UI shows current schedule).
- **AppHeader**: notification bell with unread count from `notifications` view.

### Technical notes
- Map: `react-leaflet` + `leaflet` + `leaflet.heat` (no API key, OSM tiles)
- Offline: `idb-keyval` for draft queue (≈600B gz)
- Email: Lovable Emails — will require domain setup dialog before Batch 2 emails actually deliver. Scaffolding works without DNS.
- All new RLS scoped via `has_role` / `current_role_level` SECURITY DEFINER functions already in DB.

### Order of execution
1. Batch 1 migration (single approval)
2. Batch 2 edge functions + email scaffold
3. Batch 3 UI (multiple file edits, may span 2 responses)
4. Batch 4 UI + map deps

Reply **approve** to start Batch 1, or tell me what to drop/reorder.