# ClassMate — Your College Timetable

ClassMate is a responsive college timetable and schedule management web application designed to help students track their daily classes, view weekly schedules, and stay organized throughout the semester.

---

## Project Links

- **Repository:** [https://github.com/dishamaurya081-create/ClassMate](https://github.com/dishamaurya081-create/ClassMate)
- **Live Application:** [Add your deployed ClassMate URL]

---

## Key Features

### Schedule & Timetable Management
- **Next Class at a Glance:** The Home tab highlights your active or next upcoming class, showing the time remaining, room number, teacher, course code, and class type (lecture, lab, workshop, or skill).
- **Daily Schedule:** View your full day's agenda chronologically with status tags indicating whether a class is completed, ongoing, or upcoming.
- **Weekly Timetable Grid:** Browse the full Monday-to-Saturday timetable with day-selector tabs, clean period cards, and custom notes.
- **Custom Class Management:** Add personal classes or extra sessions, edit class details (time, room, teacher), or delete entries. Changes persist locally and sync to the cloud when signed in.
- **Official Timetable Reset:** Restore your schedule back to the official departmental timetable at any time with a single click.

### Student Preferences & Timetable Filtering
- **Section Selection:** Configured with official timetable data for sections **CSE-11** through **CSE-16** (sections CSE-17 to CSE-20 are reserved for upcoming data).
- **Batch & Group Personalization:** Filter shared timetable slots by lab group (**Group 1** / **Group 2**) and specialization batch (**DV Batch 1**, **DV Batch 2**, or **Cloud**).
- **Onboarding Flow:** New students are guided through an onboarding modal to set their name, section, batch, and group before entering the dashboard.
- **Profile Synchronization:** Student settings are stored locally in `localStorage` for instant offline startup and synced to Supabase when authenticated.

### Authentication & UI Experience
- **Supabase Authentication:** Secure email and password sign-up and sign-in with session persistence and email confirmation link support.
- **Theme Modes:** Dark and light theme toggle with system-friendly contrast and preference saved in `localStorage` (dark mode by default).
- **Responsive Layout:** Optimized mobile experience with a fixed bottom navigation bar and a desktop sidebar layout.

### Notifications & Progressive Web App (PWA)
- **In-App Class Reminders:** Client-side notification service that evaluates upcoming classes and delivers alerts via the browser's native Notification API before classes begin.
- **Web Push Foundation:** Service worker (`public/sw.js`) and database schema for background Web Push notifications using VAPID signing.
- **Installable PWA:** Web App Manifest and service worker registration enable users to install ClassMate as a standalone app on supported desktop and mobile devices.
- **PDF Timetable Ingestion:** Includes a Node.js extraction script (`scripts/import-timetable.mjs`) to parse canonical departmental timetable PDFs into typed TypeScript schedule data.

> **Note on Implementation Status:**
> - Full offline data caching via service worker cache storage has not yet been implemented; an active network connection is required for cloud synchronization.
> - Background Web Push alerts while the browser is closed require deploying the Supabase Edge Function (`send-push-notification`) and configuring scheduled database cron triggers (`pg_cron`).

---

## Screenshots

<!--
To add screenshots, upload image files to a `screenshots/` directory in the repository and uncomment the lines below:

![ClassMate Dashboard](./screenshots/dashboard.png)
![Weekly Timetable](./screenshots/timetable.png)
![Student Settings](./screenshots/settings.png)
-->

*Screenshots can be added here to showcase the Home view, Weekly Timetable, and Settings screens.*

---

## Technology Stack

- **Frontend Framework:** [React 19](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Build Tool & Dev Server:** [Vite 8](https://vite.dev/)
- **Styling:** Vanilla CSS with custom properties (CSS variables), glassmorphism accents, and responsive layouts
- **Backend & Authentication:** [Supabase](https://supabase.com/) (Auth, PostgreSQL, Row-Level Security, Database Functions)
- **Linter:** [Oxlint](https://oxc.rs/)
- **PDF Extraction:** [pdfjs-dist](https://github.com/mozilla/pdf.js) (used during build-time timetable imports)
- **Web Standards:** Web Notification API, Web Push API, Service Workers, Web App Manifest

---

## Project Structure

```
ClassMate/
├── public/                       # Static public assets served at root
│   ├── favicon.svg               # Application icon
│   ├── manifest.webmanifest      # PWA installation manifest
│   ├── pwa-192x192.png           # PWA icons
│   ├── pwa-512x512.png
│   └── sw.js                     # Service worker (Web Push & PWA lifecycle)
├── scripts/                      # Developer and maintenance scripts
│   ├── generate-vapid-keys.cjs   # Generates VAPID key pairs for push setup
│   ├── generate-pwa-icons.ps1    # Utility script for PWA icon assets
│   └── import-timetable.mjs      # Node script to extract timetable from PDF
├── src/                          # Application source code
│   ├── components/               # React UI components
│   │   ├── AuthCallbackScreen.tsx # Email confirmation handler
│   │   ├── AuthScreen.tsx        # Sign-in and sign-up form
│   │   ├── ClassModal.tsx        # Add / Edit class modal
│   │   ├── DeleteConfirmModal.tsx # Class deletion confirmation
│   │   ├── Header.tsx            # App top bar with theme toggle
│   │   ├── Icons.tsx             # Lightweight SVG icon collection
│   │   ├── Navigation.tsx        # Mobile bottom bar & desktop sidebar
│   │   ├── NextClassCard.tsx     # Current / Next class status card
│   │   ├── OnboardingScreen.tsx  # Initial student profile setup
│   │   ├── Settings.tsx          # Profile, notifications, & preferences
│   │   ├── TodaySchedule.tsx     # Chronological day schedule list
│   │   └── WeeklyTimetable.tsx   # Weekly timetable grid view
│   ├── context/                  # Authentication context & hooks
│   │   ├── AuthContext.tsx
│   │   ├── authContextDef.ts
│   │   └── useAuth.ts
│   ├── data/                     # Schedule data files
│   │   └── timetable.ts          # Extracted official timetable data
│   ├── services/                 # External services & data storage
│   │   ├── browserNotificationDelivery.ts # Browser notification API
│   │   ├── notificationService.ts # Notification schedule calculation
│   │   ├── pushSubscriptionService.ts    # Web push subscription handling
│   │   ├── settingsStorage.ts    # Local user settings management
│   │   ├── supabaseClient.ts     # Supabase client initialization
│   │   ├── supabaseProfileService.ts     # Cloud profile synchronization
│   │   ├── supabaseTimetableService.ts   # Cloud timetable synchronization
│   │   └── timetableStorage.ts   # Local & cloud timetable orchestrator
│   ├── styles/
│   │   └── index.css             # Main stylesheet and design system
│   ├── types/                    # TypeScript interfaces & types
│   │   ├── notification.ts
│   │   ├── timetable.ts
│   │   └── webPush.ts
│   └── utils/                    # Helper functions
│       ├── authCallback.ts
│       ├── authRedirect.ts
│       ├── theme.ts              # Theme management
│       └── timeUtils.ts          # Schedule math & time calculations
├── supabase/                     # Supabase database schemas & Edge Functions
│   ├── functions/
│   │   └── send-push-notification/ # Edge function for background Web Push
│   ├── notification_deliveries.sql # Notification delivery tracking schema
│   ├── push_subscriptions.sql    # Web push subscriptions schema
│   ├── scheduler.sql             # pg_cron scheduler definition
│   └── schema.sql                # Core database schema, tables & RLS
├── timetable-source/             # Source PDFs for timetable import
│   └── timetable.pdf             # Canonical departmental timetable PDF
├── .env.example                  # Template for required environment variables
├── package.json
└── vite.config.ts
```

---

## How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or later recommended)
- `npm` (bundled with Node.js)
- A [Supabase](https://supabase.com/) project (optional for basic local preview, required for authentication and cloud sync)

### 1. Clone the Repository
```bash
git clone https://github.com/dishamaurya081-create/ClassMate.git
cd ClassMate
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
# On Windows PowerShell
Copy-Item .env.example .env

# On macOS/Linux or Git Bash
cp .env.example .env
```
Open `.env` and fill in your Supabase project credentials (see [Environment Variables](#environment-variables)).

### 4. Start Development Server
```bash
npm run dev
```
Open your browser and navigate to the local URL displayed in your terminal (typically `http://localhost:5173`).

### 5. Other Available Scripts
- **Run Linter:**
  ```bash
  npm run lint
  ```
- **Build for Production:**
  ```bash
  npm run build
  ```
- **Preview Production Build:**
  ```bash
  npm run preview
  ```
- **Re-import Timetable from PDF:**
  ```bash
  npm run import:timetable
  ```

---

## Environment Variables

ClassMate requires configuration variables for its frontend client. These variables must begin with `VITE_` so Vite can expose them to the browser bundle.

| Variable Name | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (for Auth/Sync) | Your Supabase project URL (e.g. `https://your-project-id.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes (for Auth/Sync) | Your Supabase Anon / Publishable API key |
| `VITE_SITE_URL` | Optional | Public application URL for authentication confirmation redirects (defaults to `window.location.origin` in local development) |
| `VITE_VAPID_PUBLIC_KEY` | Optional (Push) | Base64url P-256 public key used to subscribe the browser to Web Push |

### Security Guidelines
- **Never commit `.env` to version control.** It is already listed in `.gitignore`.
- **Public vs. Private keys:** `VITE_` variables are bundled into client-side JavaScript and are visible to anyone using the app. Only expose public credentials (`VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_VAPID_PUBLIC_KEY`).
- **Never place secrets in `.env`:** Do **not** store your `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, or `SCHEDULER_SECRET` in the frontend `.env`. These belong exclusively in the **Supabase Dashboard** under **Project Settings → Edge Functions → Secrets**.

---

## Authentication and User Setup

ClassMate uses Supabase Authentication for student accounts:

1. **Sign Up:** A student enters their name, email, and password. Supabase creates the user account.
2. **Email Confirmation:** If email verification is enabled in your Supabase project, an activation link is sent to the student's email. Clicking the link redirects back to the application via `AuthCallbackScreen.tsx` to complete the session exchange.
3. **First-Time Onboarding:** Upon initial sign-in, the student is prompted with an onboarding dialog to choose:
   - Student Name
   - Current Section (`CSE-11` through `CSE-20`)
   - Specialization Batch (`DV Batch 1`, `DV Batch 2`, or `Cloud`)
   - Lab Group (`Group 1` or `Group 2`)
4. **Session Persistence:** Login sessions are stored securely using Supabase Auth storage in the browser, keeping the student logged in across visits.

---

## Notifications Architecture

ClassMate includes a multi-tier notification design:

```
[Student Device]
       │
       ├─► In-App Alerts (Web Notification API)
       │     └─ Checks upcoming classes every minute and triggers alerts before class.
       │
       └─► Background Web Push (Web Push API + Service Worker)
             ├─ Browser subscribes via VAPID public key.
             ├─ Endpoint stored in Supabase `push_subscriptions` table.
             └─ Supabase `send-push-notification` Edge Function dispatches push
                messages via web push protocol when scheduled.
```

### Setup Requirements for Web Push
1. **Generate VAPID Keys:**
   ```bash
   node scripts/generate-vapid-keys.cjs
   ```
2. **Configure Frontend:** Add `VITE_VAPID_PUBLIC_KEY` to your `.env`.
3. **Configure Edge Function Secrets:** In Supabase Dashboard, set:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (e.g. `mailto:admin@yourdomain.com`)
   - `SCHEDULER_SECRET` (token to secure the cron trigger)
4. **Run SQL Migrations:** Execute `supabase/push_subscriptions.sql` and `supabase/notification_deliveries.sql` in the Supabase SQL Editor.
5. **Set Scheduler:** Execute `supabase/scheduler.sql` to configure the 5-minute background cron job.

> **Delivery Considerations:** Web notifications require explicit browser permission. Actual background notification delivery when the browser is completely closed depends on operating system battery saver policies, browser background process permissions, and platform support (e.g., desktop browsers, Android, or iOS 16.4+ when added to the home screen).

---

## PWA Installation

ClassMate includes Progressive Web App support:
- **Desktop (Chrome / Edge):** Click the install icon in the browser address bar to install ClassMate as a standalone desktop window.
- **Mobile (Android Chrome):** Tap the browser menu and select **Install app** or **Add to Home screen**.
- **Mobile (iOS Safari):** Tap the Share icon and select **Add to Home Screen**.

The application launches with a custom theme bar, standalone window frame, and custom launcher icons.

---

## PDF Timetable Importing

ClassMate includes an automated importer for institutional schedule updates:

- **Command:**
  ```bash
  npm run import:timetable
  ```
- **Workflow:**
  1. Place the updated college schedule PDF at `timetable-source/timetable.pdf`.
  2. Run the import command.
  3. The script extracts section data, course codes, time slots, rooms, and faculty abbreviations using `pdfjs-dist`.
  4. The generated data is written directly to `src/data/timetable.ts`.
- **Format Limitations:** The importer uses specific layout and text heuristics matched to the canonical college schedule format. It is tailored to this structure and will require adjustments if used with different institutional PDF layouts.

---

## Deployment

ClassMate builds as a static Single Page Application (SPA) and can be hosted on any static web host (such as Vercel, Netlify, or Cloudflare Pages).

### Build Command
```bash
npm run build
```
The output files will be generated in the `dist/` directory.

### Hosting Configuration
1. **Set Environment Variables:** Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SITE_URL` in your hosting dashboard before triggering the production build.
2. **SPA Routing:** Ensure your hosting platform redirects all incoming requests to `/index.html` so client-side routing and auth callback routes function correctly.
3. **Supabase Auth Redirects:** In your Supabase Dashboard under **Authentication → URL Configuration**, add your deployed production URL to the **Site URL** and **Redirect URLs** allowlist:
   - `https://your-deployed-domain.com/**`
   - `http://localhost:5173/**` (for local development)

---

## Troubleshooting

### 1. Supabase Connection Error / Data Not Loading
- **Cause:** Missing or malformed Supabase credentials.
- **Solution:** Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` match your Supabase project settings. Restart Vite (`npm run dev`) after editing `.env`.

### 2. Authentication Confirmation Link Redirects to Wrong URL
- **Cause:** Supabase project Site URL or Redirect URLs allowlist is not configured.
- **Solution:** Add your local (`http://localhost:5173/**`) or production URL to Supabase Dashboard under **Authentication → URL Configuration**.

### 3. Notifications Not Appearing
- **Cause:** Browser notifications permission is denied or blocked.
- **Solution:** Open your browser's site settings for ClassMate, change the Notifications permission to **Allow**, and reload the page.

### 4. PDF Import Errors
- **Cause:** `timetable-source/timetable.pdf` is missing or in an unexpected format.
- **Solution:** Ensure the PDF exists at the expected path and matches the departmental timetable table structure.

### 5. Production Build Warnings About Chunk Size
- **Cause:** Pre-compiled timetable dataset and large libraries.
- **Solution:** This warning does not block builds. The bundle can be optimized using dynamic imports (`React.lazy`) if smaller chunk sizes are desired.

---

## Roadmap

Planned improvements for future releases:
- [ ] Service worker offline caching strategy for static application assets
- [ ] Calendar export support (`.ics` file generation for Google Calendar / Apple Calendar)
- [ ] Attendance tracker with subject-wise attendance thresholds
- [ ] Assignment and exam deadline tracker
- [ ] Timetable support for additional engineering branches and semesters

---

## Contributing and License

### Contributing
Contributions and bug reports are welcome. Feel free to open an issue or submit a pull request with targeted fixes and improvements.

### License
No license has been specified yet for this project. All rights are reserved by the project author unless explicitly stated otherwise.

---

## Acknowledgments

- Built with [React](https://react.dev/), [Vite](https://vite.dev/), and [Supabase](https://supabase.com/).
- PDF parsing powered by [Mozilla's PDF.js](https://github.com/mozilla/pdf.js).
- Timetable data inspired by college schedule management needs.
- Developed by **Disha Maurya**.
