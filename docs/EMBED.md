# Embedding the donate widget

`/embed/[ngoId]` is a self-contained donate form — logo-free, header/footer-free
— meant to be loaded in an `<iframe>` on an NGO's own website so their
visitors can start a StreamGive donation without leaving the page. This
covers the integration contract for anyone embedding it: NGOs and any
third-party developer building their site.

## Getting your snippet

The easiest way to get a correct snippet is the **Embed your donate
widget** panel on `/ngo-admin` (see
[`src/components/ngoAdmin/EmbedSnippet.tsx`](../src/components/ngoAdmin/EmbedSnippet.tsx)),
which fills in your NGO's id and the app's own origin for you and lets you
pick a size. The rest of this document explains what that snippet means so
you can hand-edit or rebuild it.

## The iframe tag

```html
<iframe
  src="https://app.streamgive.example/embed/YOUR_NGO_ID"
  width="400"
  height="600"
  style="border:0"
></iframe>
```

- `YOUR_NGO_ID` is StreamGive's internal id for your NGO (not your Stellar
  address) — copy it from the generated snippet on `/ngo-admin` rather than
  typing it by hand.
- The route takes **no query parameters**. There is currently no way to
  customize colors, currency, or preset amounts via the URL — everything
  shown is driven by your NGO's profile.
- `width`/`height` are the two properties you can freely change. There's no
  responsive/percentage sizing mode; the widget renders at a fixed pixel
  size and the surrounding page controls that size the way it would any
  other iframe.

## Sizing

The generator on `/ngo-admin` offers these presets (all in pixels):

| Preset   | Width | Height |
| -------- | ----- | ------ |
| Compact  | 300   | 500    |
| Standard | 400   | 600    |
| Wide     | 600   | 400    |
| Custom   | any   | any    |

Standard is the default and fits the form comfortably. If you pick a custom
size, leave enough height for the full form (amount, token, duration, and
the connect/submit button) — too short a frame means the form scrolls
inside itself, which reads as broken on most host pages.

## Security headers

Every route in this app sends `X-Frame-Options: DENY` **except** `/embed/*`,
which omits it deliberately so it can be framed at all (see
[`src/middleware.ts`](../src/middleware.ts)). There is no
`Content-Security-Policy: frame-ancestors` allowlist restricting *which*
sites may embed it — any site can iframe `/embed/[ngoId]` today. Don't rely
on this page being un-embeddable elsewhere; it's intentionally open so any
NGO can self-serve their own integration without a backend allowlist step.

The embed page also sets `robots: { index: false, follow: false }` (see
[`src/app/embed/[ngoId]/page.tsx`](../src/app/embed/[ngoId]/page.tsx)) — it's
not meant to be indexed or visited directly outside an iframe.

### The `sandbox` attribute

If your site's CMS or security policy adds a `sandbox` attribute to
iframes by default, **do not apply a restrictive one here.** Connecting a
wallet needs the frame to open popups and run scripts, so at minimum a
sandboxed iframe needs:

```html
<iframe
  src="https://app.streamgive.example/embed/YOUR_NGO_ID"
  width="400"
  height="600"
  style="border:0"
  sandbox="allow-scripts allow-popups allow-forms allow-same-origin"
></iframe>
```

Omitting `sandbox` entirely (the default, and what the generated snippet
does) is simplest and is what's tested.

## Platform-specific examples

### Plain HTML

```html
<!doctype html>
<html>
  <body>
    <h2>Support us</h2>
    <iframe
      src="https://app.streamgive.example/embed/YOUR_NGO_ID"
      width="400"
      height="600"
      style="border:0"
    ></iframe>
  </body>
</html>
```

### WordPress

WordPress's block editor strips raw `<iframe>` tags from a standard
Paragraph block, so use a **Custom HTML** block instead:

1. Add a block, search for "Custom HTML".
2. Paste the snippet from `/ngo-admin` as-is.
3. Preview the page — the block editor's own preview renders iframes, so
   you'll see the widget before publishing.

If your theme or a security plugin (e.g. Wordfence) strips iframes on
save, look for an "allowed HTML tags" or "unfiltered_html" setting rather
than working around it — that's the plugin filtering the tag out, not
something wrong with the snippet.

### Webflow

1. Add an **Embed** element (Add panel → Embed) where you want the widget.
2. Paste the snippet from `/ngo-admin` into the embed code box.
3. Set the Embed element's own width/height in the Webflow designer to
   match (or exceed) the `width`/`height` on the `<iframe>` tag — Webflow's
   embed wrapper doesn't auto-size to the iframe's content.
