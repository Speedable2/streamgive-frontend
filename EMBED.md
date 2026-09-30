# Embed Widget Guide

The StreamGive embed widget allows verified NGOs to accept recurring, streaming donations directly from their own website, without donors needing to navigate away to the main StreamGive platform.

## Getting the Snippet

To get the embed snippet for your NGO:
1. Ensure your NGO application has been approved and you are verified.
2. Connect your NGO's wallet and navigate to the **NGO Admin** page (`/ngo-admin`).
3. Under the "Managing streams" section, you will find a code snippet generator labeled **"Embed your donate widget"**.
4. Copy the generated `<iframe>` snippet and paste it into your website's HTML.

## Sizing Guidance

The embed snippet generator provides three preset sizes and a custom option:
- **Compact**: 300×500
- **Standard**: 400×600 (Recommended)
- **Wide**: 600×400
- **Custom**: Specify your own dimensions.

You can modify the `width` and `height` attributes directly on the `<iframe>` tag to better fit your site's layout, but ensure there is enough room for the wallet connection prompts and donation form fields.

## Important: `sandbox` Attributes

**Do NOT apply a restrictive `sandbox` attribute to the iframe.** 
The donation flow involves connecting a web3 wallet (like Freighter), which inherently requires:
- `allow-popups`: To open the wallet extension's connection/signing window.
- `allow-scripts`: To execute the client-side wallet connection logic and Stellar transactions.
- `allow-same-origin`: To allow the iframe to maintain its origin state for web3 interactions.

A restrictive `sandbox` without these permissions will silently break the donation flow. The provided default snippet intentionally does not include a `sandbox` attribute.

## API Unreachable Fallback

If the backing StreamGive API is unreachable or down, the widget handles this gracefully. It will display a simple fallback message centered in the iframe:
"Couldn't reach the StreamGive API."

This ensures your website's layout doesn't break and donors see a clear reason why the widget is unavailable.
