# Voicela shared design contract

Components use semantic Tailwind v4 colors (`background`, `foreground`, `card`,
`muted`, `muted-foreground`, `border`, `accent`, `accent-soft`, `primary`,
`danger`, `success`, `ring`). Add `.dark` to an ancestor for dark mode. Navbar
persists the explicit theme under `voicela:theme` when storage is available.

Typography: Geist for the interface, Geist Mono for data, `.v-editorial` or
`font-serif` for a Georgia editorial aside. `.v-display` provides fluid 48–96px
display type. Section spacing is `--space-section`; radii are 4/8/12/16px.
Motion tokens are 160ms hover, 240ms panel, 600ms hero, with strong ease-out.

## Components

- `Button`: primary/secondary/ghost/outline, sm/md/lg/icon, loading, asChild.
  Use one child link for `asChild`. Label icon-only buttons with `aria-label`.
- `Badge` (`Pill` alias): default/accent/outline/success, optional dot.
- `Card`: default/muted/outline; optional CardHeader, CardTitle, CardContent.
- `Container`: default/wide/narrow widths.
- `Section`: id, eyebrow, title, subtitle, align, containerClassName, children.
- `Accordion`: items `{ id?, question, answer }[]`; optional shared `name`
  permits one open item. Native details works without client JavaScript.
- `Input`, `Textarea`, `Field`: Field accepts label, htmlFor, hint, error,
  required. Set the control's aria-describedby to `ID-description` / `ID-error`
  as appropriate and aria-invalid when an error exists.
- `Marquee`: duration in seconds, reverse, children. Pauses on hover/focus,
  includes a pause button, and becomes static for reduced motion.
- `Reveal`: delay/duration in seconds, once. Content is visible before JS.
- `AnimatedVoiceOrb`: activity 0–1, size in pixels or CSS width, label,
  standard div props. It visualizes supplied data; it never requests audio.
- Navbar and Footer export both defaults and named aliases.
- `useReducedMotion` / `useMotion` from `components/motion/use-motion`:
  conservative SSR snapshot, live preference updates, plus `MOTION` constants.

## Helpers and seeded data

`track` logs only when `setAnalyticsConsent(true)` was explicitly called.
Consent defaults off, is checked on every event, and storage failures no-op.
Do not include email, transcripts, or document contents in analytics payloads.
`EVENTS` includes uppercase and lowercase keys for the five defined events.

`submitWaitlist(email, platform?)` validates, normalizes, and simulates 650ms
latency. Supported platform values: windows/macos/linux/android/ios. It
returns `{ ok: true, email }`, but does not store or transmit registration.
Show that limitation in forms until a real backend is connected.

Seed modules export typed arrays plus these helpers:

- demo-files: demoFiles (mockFiles), fileIntents, fileErrors.
- demo-mail: demoMail (mockInbox), demoDraft (mockDraft).
- demo-calendar: demoCalendar (mockCalendar), demoContacts (mockContacts),
  seededConflict, proposedMeeting, calendarContext. All times are fixed in
  Asia/Kolkata on 12 November 2026; the 14:00 conflict moves a proposal to 14:30.
- demo-chart: demoChart (demoChartData, mockChart), screenContext. Counts and
  summary are illustrative: 36 → 42 projects, +6 / +16.7%.

The homepage and demo own their compositions and route behavior. Shared
components introduce no microphone access, external messages, or real actions.
