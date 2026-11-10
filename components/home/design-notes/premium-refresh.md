# Premium homepage refresh

Kind: software. Primary action: Try the demo.

Direction: preserve Design.md.txt's warm paper, Geist, editorial serif, restrained accent and product-led split hero. The collage deal informs the product stage; the user's design specification takes precedence over random palettes, compulsory effects, exact screen-height sections and photo-filled type. No copied reference-site assets. No generated customer endorsements.

Voice: calm, concrete, aspirational; demonstrate a task and distinguish today's simulation from planned desktop capabilities. Pricing stays available through the navigation and FAQ; the unconfirmed ₹1 offer no longer dominates the homepage.

Sections: voice-assistant hero with playable product UI; request-to-draft workflow; original studio photograph and feature links; permission model; FAQ; demo close and concise footer. Preserve the full demo route and other product routes. Replace non-persistent homepage signup previews with direct links to the usable demo.

Motion: one short hero entrance; user-triggered workflow replay with pause; hover/press feedback. Reduced motion disables decorative transitions. No autoplay video or continuously running animation.

Original generated assets (built-in image generation):
- public/images/voicela-coast.webp — 1536 × 1024, 222,312 bytes. Desktop wallpaper behind live HTML UI.
- public/images/voicela-studio.webp — 1536 × 1024, 200,714 bytes. Editorial illustration of a quiet workspace, not a customer's office or testimonial.

## Generation prompts

Coastal wallpaper:
Use case: photorealistic-natural. Asset: original premium desktop wallpaper for Voicela voice assistant website, landscape 3:2. A cinematic fine-art photograph of a windswept coastal hillside, soft pale sand dunes in foreground, dark pine silhouettes at left, distant slate blue ocean and hazy horizon, soft warm morning sunlight. Restrained warm ivory, sage, slate blue, natural grain, extraordinary photographic detail, quiet atmospheric depth, sophisticated editorial art direction. Wide landscape, clean central and right areas to hold a live software interface overlay. No buildings, people, text, logos, UI, devices, purple, surreal shapes, glowing orbs. Save the generated image for project use.

Studio:
Use case: photorealistic-natural. Original editorial photograph for a premium voice assistant website. Landscape 3:2. A thoughtfully designed quiet creative studio in natural morning light: large pale oak desk, slim open unbranded silver laptop seen from behind at a three-quarter side angle, closed cream notebook and a simple ceramic cup, one sculptural wooden chair, linen curtain, large window overlooking softly blurred greenery. Beautiful tactile plaster walls, rich shadow, brushed aluminum, subtle film texture. Architectural Digest quality, understated and lived-in, no excessive styling, no people. Desk occupies lower half, strong composition, warm ivory and muted olive, precise realistic materials. No logos, text, watermark, UI, glowing effects or purple. Not a stock corporate office.

## Validation

- Website-only TypeScript: zero diagnostics (exclude the independently developed desktop package).
- Production compilation passes; full build blocked by existing desktop/src/features/engine/planner.ts TS5097 and desktop/vite.config.ts TS2578.
- GATE: ERROR. The design skill's browser checker could not find Chrome; copy extraction and responsive/layout checks did not complete. Per the skill, the gate was not rerun.
- Visual browser inspection is tracked separately; no conversion improvement or Core Web Vitals claim is made.

No prices, customer metrics, release dates, security certifications or purchase flow were invented. Video generation was unavailable; the product story is a live HTML interaction, not a generated video.
