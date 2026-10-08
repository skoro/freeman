# Freeman

**Freeman** is an open-source, self-hosted, web-based REST API client — a lightweight [Postman](https://www.postman.com/) alternative you can run on your own server.

No desktop install. No data leaves your network. Your team accesses it from any browser.

**Website:** [turingcomplete.in/product/freeman](https://turingcomplete.in/product/freeman)

---

## Features

- **Collections & folders** — organise requests just like Postman
- **Collection variables** — define `{{BASE_URL}}` once, reuse everywhere across the collection
- **Import / Export** — full Postman Collection v2.1 compatibility; migrate in seconds
- **Auth helpers** — Bearer token, Basic auth, and API Key support built in
- **Team accounts** — super admin creates accounts; no self-registration
- **Shared collections** — all team members can view and edit collections
- **CORS-free** — all requests are proxied server-side via Guzzle; no browser restrictions
- **Rate limiting** — 60 requests/min per user on the run endpoint
- **Self-contained** — SQLite database, no external services required

---

## Requirements

| Requirement | Version |
|---|---|
| PHP | 8.2 or higher |
| Composer | 2.x |
| Node.js | 20.19+ or 22.12+ |
| npm | 10 or higher |
| PHP extension: `pdo_sqlite` | required |
| PHP extension: `openssl` | required |
| PHP extension: `curl` | required |
| PHP extension: `mbstring` | required |
| PHP extension: `xml` | required |

> Node.js and npm are required to install and build the frontend assets with Vite.

### Installing missing PHP extensions

**Ubuntu / Debian**
```bash
sudo apt install php-sqlite3 php-curl php-mbstring php-xml
```

**RHEL / Fedora**
```bash
sudo dnf install php-pdo php-sqlite3 php-curl php-mbstring php-xml
```

**Windows** — enable the relevant extensions in your `php.ini`:
```ini
extension=pdo_sqlite
extension=curl
extension=mbstring
extension=openssl
```

**macOS (Homebrew)** — extensions are bundled with the `php` formula.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/freeman.git
cd freeman
```

### 2. Install PHP dependencies

```bash
composer install
```

> **Do this first.** The install wizard (`php artisan freeman:install`) will attempt to run `composer install` automatically, but on some servers (restricted PATH, missing `composer` in shell, etc.) this step can fail silently. Running it manually first avoids any issues.

### 3. Install and build frontend assets

```bash
npm install
npm run build
```

### 4. Run the install wizard

```bash
php artisan freeman:install
```

The wizard will:

1. Check all PHP extension requirements
2. Copy `.env.example` → `.env`
3. Generate a secure `APP_KEY`
4. Create the SQLite database file
5. Run all database migrations
6. Prompt you to create your super admin account

### 5. Set your app URL

Open `.env` and update:

```ini
APP_URL=https://your-domain.com
```

### 6. Start the server

**Development**
```bash
php artisan serve
```
Then open [http://localhost:8000](http://localhost:8000) in your browser.

For frontend development, run `npm run dev` (or use `composer run dev` to start
the Laravel services and Vite together).

**Production (recommended: nginx + php-fpm)**

Point your web server's document root at the `public/` directory and set the following in `.env`:

```ini
APP_ENV=production
APP_DEBUG=false
```

---

## Updating

```bash
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:clear
php artisan cache:clear
```

---

## Configuration

All configuration lives in `.env`. Key settings:

| Key | Description | Default |
|---|---|---|
| `APP_NAME` | Displayed in the browser tab | `Freeman` |
| `APP_URL` | Full public URL where Freeman is hosted | `http://localhost:8000` |
| `APP_ENV` | Set to `production` for live deployments | `production` |
| `APP_DEBUG` | Always `false` in production | `false` |
| `SESSION_LIFETIME` | Session timeout in minutes | `120` |

---

## User management

Only the super admin can create user accounts — there is no self-registration. Log in with your super admin credentials and go to **Admin → Users**.

New users are prompted to change their password on first login.

---

## Collection variables

Use `{{VARIABLE_NAME}}` syntax in any URL, header, or request body. Variables are defined per-collection under **Variables** in the collection settings panel and are substituted at request time.

---

## Import & Export

Freeman uses the **Postman Collection v2.1** format for both import and export, making it straightforward to migrate existing Postman collections without any manual work.

- **Export** — open a collection and click **Export**
- **Import** — click **Import** in the sidebar and upload a `.json` file

---

## Roadmap

| Feature | Status |
|---|---|
| Collections, folders, saved requests | ✅ Done |
| Request builder (headers, body, auth) | ✅ Done |
| Collection variables (`{{VAR}}`) | ✅ Done |
| Import / Export (Postman v2.1) | ✅ Done |
| Auth helpers (Bearer / Basic / API Key) | ✅ Done |
| Rate limiting on request execution | ✅ Done |
| Shared collections (all team members) | ✅ Done |
| `freeman:install` wizard | ✅ Done |
| File upload support (multipart/form-data) | ✅ Done |

---

## License

MIT — free to use, modify, and self-host.
