# Homepage verification

Owned source: app/page.tsx and components/home only. Shared components, globals, lib and configuration were not edited.

- npm run build: exit 0; homepage and demo statically prerendered. Final source build passed after the privacy heading was shortened and owned source formatted.
- npm run dev: localhost:3000; curl returned 200 and SSR HTML contained Less clicking.
- Browser smoke: simulated voice completion; workflow forward/back; desktop app switching; context selection/summary; privacy route switch; honest validation-only waitlist success; mobile no horizontal overflow; reduced-motion media setting; no browser exceptions.
- Render reviewed at 1440, 768, 390. Production renders were also inspected. The automatic taste gate still flags shared navbar/accordion hairlines and footer small print, plus the necessary pricing disclosure as an eyebrow; these shared elements were kept to honor the component contract. No zero-finding claim is made. The tablet privacy heading was shortened after the first review.
- Editorial direction: sentence-as-layout, seed 1061451020. Interface fragments replace photography per the product-visualization brief. No stock pictures or videos. Samples: Maya/project documents/calendar are mock content.
- Final visual critique: design 8, usability 8, creativity 7, content 8 (7.8 weighted). Strength: clear first-screen promise and working, inspectable interactions. Limitation: the shared footer repeats signup and the backend is not connected.

Contract gaps: submitWaitlist validates but persists nothing; form discloses this before submit and after success. Its actual API is submitWaitlist(email, platform), not an object. No missing component fallback remains. Shared Button's server-child issue was avoided by a local client CTA wrapper. A namespaced own CSS file avoids the project CSS-module loader issue without editing configuration.
