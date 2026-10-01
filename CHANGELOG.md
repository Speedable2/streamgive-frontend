# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing has been tagged/released yet, so this section currently covers all
work to date.

### Added

- Landing page with hero and how-it-works sections, later updated to show
  live platform totals.
- Wallet connection via Stellar Wallets Kit, with a warning when the
  connected wallet is on the wrong network.
- NGO explorer with search, sort, "Load more" pagination, loading
  skeletons, and a distinct empty state for no matching NGOs.
- NGO profile pages showing stats, recent streams, and a copy-link button.
- Public platform impact page showing platform-wide totals.
- Donation flow: create-stream form with custom token address validation
  and a human-readable error when the donation contract isn't configured;
  USDC added alongside native XLM as a token option.
- Donor dashboard with stream list and totals, a top-up action, a
  confirmation step before cancelling a stream, and a preview of the new
  rate and end date before modifying a stream.
- CSV export of donation history from the dashboard.
- Stream details modal shared by the dashboard and NGO admin views.
- NGO onboarding application form and platform admin panel for NGO
  approval, including reviewer notes and submission dates on applications.
- NGO admin panel with a withdraw action.
- Embeddable donate widget, with a choice of preset or custom widget size.
- Dark mode support across the layout, pages, and toasts.
- Toast notifications for on-chain action feedback.
- Reusable copy-address button and `truncateAddress` helper, with
  addresses and token contracts linked to the Stellar block explorer.
- Docker-based production deployment config and a CI workflow for lint,
  typecheck, and build.
- Accessibility pass (contrast, live regions, accessible names on
  icon-only controls) and SEO metadata.
- Unit and e2e test coverage, including wallet connect, the create-stream
  form, the donor flow, security headers/middleware, `StreamControls`, and
  `WithdrawButton`.
- `CONTRIBUTING.md` (with a Testing section and accessibility checklist)
  and `ENVIRONMENT.md`, plus a Troubleshooting section in the README.

### Changed

- Mobile navigation and list controls made responsive; the mobile nav menu
  now closes automatically when the viewport widens past the `md`
  breakpoint.
- NGO applications are now registered on-chain at apply time, and the
  `/ngo-applications` response is unwrapped correctly now that it's
  paginated.

### Fixed

- Wallet no longer re-prompts for a signature that is still valid.
- The embed widget reads its origin from the browser instead of a
  hardcoded env var.
- Vercel deploys skip Next.js standalone output, which isn't needed there.
- Unverified NGOs correctly show an awaiting-review state instead of
  looking rejected or missing.
- Stream controls show the correct in-flight label while a transaction is
  pending.
- The impact page's load-error notice now clears after a successful poll
  instead of persisting once one fetch fails.
- Donation amounts are parsed without floating-point precision loss.
- `truncateAddress` no longer throws on input shorter than the truncation
  window.
- A broken merge that left invalid syntax and a stale lockfile in place
  was repaired so CI (lint, typecheck, build, and both test suites) passes
  end to end again.
