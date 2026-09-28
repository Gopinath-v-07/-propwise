# Propwise Property Operations Dashboard

Propwise is a responsive React and TypeScript dashboard for property managers. It includes role-aware authentication, property management, service-request operations, dashboard analytics, notifications, search, preferences, and export workflows.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The manager demo account is:

- Email: `manager@propwise.test`
- Password: `demo123`

## Available commands

```bash
npm run lint    # Run Oxlint
npm run build   # Type-check and create the production bundle
npm run preview # Serve the production bundle locally
```

The application stores demo-session, property, dashboard-layout, notification, and preference data in browser `localStorage`. This is intentional for the frontend prototype; production authentication and persistence should be connected to server APIs before deployment.

## Completed product scope

- Responsive application shell with desktop sidebar and mobile navigation drawer
- Protected role-aware routes and demo authentication
- Editable user profile and workspace preferences
- Add-property workflow with validation and persistence
- Dashboard KPIs, occupancy visualization, service-request table, filters, and pagination
- Request detail drill-down, dashboard refresh state, widget customization, and CSV/JSON exports
- Global search across properties and service requests
- Notifications panel with unread state and mark-all-read behavior
- Keyboard focus states, Escape-to-close overlays, reduced-motion support, and compact dashboard mode

## Production deployment

Build the static bundle with `npm run build`, then deploy the generated `dist/` directory to a static hosting provider such as Azure Static Web Apps, Azure Storage static website hosting, or another CDN-backed host. Configure SPA fallback routing so paths such as `/manager/dashboard` and `/settings` serve `index.html`.

Before deployment, run both `npm run lint` and `npm run build`. Use `npm run preview` to smoke-test the generated bundle locally.
