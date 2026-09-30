# Component architecture

An overview of `src/components/`, grouped by directory, for finding where
to add or modify UI. Page-level composition lives in `src/app/**/page.tsx`
and isn't repeated here — this covers the reusable pieces those pages render.

```
src/components/
├── common/
│   ├── CopyAddressButton.tsx    — Copies a full address to the clipboard, showing a brief label change as confirmation.
│   └── CopyLinkButton.tsx       — Copies the current page URL to the clipboard, with the same confirmation style.
├── dashboard/
│   └── StreamControls.tsx       — Donor controls for an active stream: top up, modify the rate, or cancel it.
├── donate/
│   └── CreateStreamForm.tsx     — Form to start a new donation stream to an NGO (amount, token, duration).
├── landing/
│   ├── HowItWorks.tsx           — Static three-step "how it works" section on the landing page.
│   └── StatsStrip.tsx           — Server-rendered platform stats strip (total committed, active streams, verified NGOs).
├── layout/
│   ├── Footer.tsx               — Site-wide footer with links to GitHub and the docs repo.
│   ├── Header.tsx                — Site-wide nav bar: logo, page links, wallet connect button, mobile menu.
│   └── Logo.tsx                  — The StreamGive mark as an inline SVG.
├── ngoAdmin/
│   ├── EmbedSnippet.tsx         — Generates the iframe embed snippet an NGO pastes into their own site, with size presets.
│   └── WithdrawButton.tsx       — Lets an NGO withdraw the available balance from one of its streams.
├── ngos/
│   ├── NgoCardSkeleton.tsx      — Loading placeholder matching the shape of a rendered NGO card.
│   └── NgoExplorer.tsx          — Searchable, sortable, paginated grid of verified NGOs.
├── streams/
│   └── StreamDetailsModal.tsx   — Modal showing the full detail of a single stream (donor, token, rate, balance, timestamps).
├── toast/
│   └── ToastProvider.tsx        — Context provider for transient success/error/info toast notifications.
└── wallet/
    ├── ConnectWalletButton.tsx — Connect/disconnect button showing the truncated address and a wrong-network warning.
    └── WalletProvider.tsx      — Context provider wrapping StellarWalletsKit: connection state, signTransaction, signMessage.
```

## Conventions

- Directories are grouped by feature/audience (`dashboard`, `donate`,
  `ngoAdmin`, `ngos`) or by cross-cutting concern (`common`, `layout`,
  `toast`, `wallet`), not by component type.
- Components that call contracts or the backend own their submit state and
  error handling locally (`useState`, `useToast`) rather than through a
  shared data layer — see `StreamControls.tsx` and `WithdrawButton.tsx`.
- `WalletProvider` and `ToastProvider` are the only two React contexts in
  the app; both are mounted once near the root layout and consumed via
  their `useWallet()` / `useToast()` hooks.
