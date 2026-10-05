# CLAUDE.md

This file provides guidance to Claude Code when working on the **freeman** project.
Always read the imported context files below before starting any task.

@.claude/project-context.md
@.claude/design-decisions.md

---

## Project Overview

**Freeman** is an open-source, self-hosted, web-based REST API client — a lightweight Postman alternative.
Built with Laravel 12, it allows teams to manage and execute REST API requests from a browser with no desktop install required.

- **Backend:** Laravel 12 (PHP)
- **Frontend:** Blade + Alpine.js + Tailwind CSS, built with Vite
- **Database:** SQLite (default, ships with Laravel)
- **Auth:** Laravel session-based auth (no JWT — web app)
- **HTTP Requests:** Laravel proxies all outgoing API calls via Guzzle (bypasses CORS)

---

## Commands

**Setup (first time):**
```bash
composer run setup
```

**Development:**
```bash
composer run dev
```
Runs: `php artisan serve`, `queue:listen`, `pail`, and `vite`.

**Testing:**
```bash
composer run test
php artisan test
php artisan test --filter TestName
```

**Linting:**
```bash
./vendor/bin/pint
./vendor/bin/pint --test
```

---

## Architecture Notes

- Laravel 12 — uses fluent builder pattern in `bootstrap/app.php` (no `Kernel.php`)
- Middleware, routing, and exception handling configured in `bootstrap/app.php`
- `routes/web.php` for all routes (no API routes — this is a web app with Blade views)
- SQLite database at `database/database.sqlite`
- All outgoing HTTP requests go through `app/Services/RequestRunnerService.php` via Guzzle
- Frontend assets are built with Vite; Alpine and workspace modules are imported by `resources/js/app.js`

---

## Code Conventions

- **Service layer** for all business logic — controllers stay thin
- **Repository pattern** for all DB queries
- **Form Requests** for all validation
- One Blade layout: `resources/views/layouts/app.blade.php`
- Alpine.js workspace components live in `resources/js/` (see DD-014): store + one file per component. Simple one-off UI state (e.g. a dropdown toggle) stays inline in Blade
- All responses from `RequestRunnerService` stored in `request_logs` table for history
- Use named routes everywhere
- PHPUnit for all tests — test DB is in-memory SQLite (configured in `phpunit.xml`)

---

## Session Efficiency Rules

- Before implementing any non-trivial feature, decompose into a numbered plan and confirm before coding
- Read only files directly needed for the current step — never speculatively
- After completing 2+ sub-tasks, write a session checkpoint with a resume prompt
- If a bug is not resolved after 3 attempts, stop and ask for specific output
- Before ending any session, add a `// TODO: [next step]` comment at the continuation point
- After completing any feature, update `project-context.md` and `design-decisions.md` to reflect changes

---

## User Management

- **Super Admin** is seeded via `php artisan db:seed` — credentials in `.env`
- Super Admin can create/delete users (username + password only)
- Users can change their own password after first login
- No self-registration — all accounts created by Super Admin
- All data (collections, environments, history) is **per-user and isolated**