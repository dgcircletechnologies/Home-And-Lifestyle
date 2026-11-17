# Home & Lifestyle UI theme

The customer and admin interfaces share a warm, editorial foundation. Tokens live in `frontend/src/app/globals.css`; use the semantic CSS custom properties rather than literal colours.

- **Surfaces:** `--hl-page`, `--hl-surface`, and `--hl-elevated` form the ivory-to-white background stack.
- **Brand actions:** `--hl-primary` is deep forest green; use `--hl-primary-hover` for hover. `--hl-accent` is terracotta and is decorative, not a primary text/action colour.
- **Text and feedback:** use `--hl-ink`, `--hl-muted`, `--hl-border`, `--hl-success`, `--hl-warning`, and `--hl-error` semantically.
- **Typography:** `--font-display` is the restrained editorial serif stack for headings; `--font-sans` is the readable system UI stack for interface text.
- **Shape and motion:** use `--hl-radius-sm`, `--hl-radius`, `--hl-shadow`, `--hl-shadow-lg`, and the 150ms/200ms transition rhythm.

`src/components/ui/auth-ui.tsx` contains the baseline button, text field, password field, and inline status patterns. Customer surfaces should favour generous spacing; admin pages may be denser but retain the same colour, type, focus-ring, and feedback language.
