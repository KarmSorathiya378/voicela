export const platforms = [
  {
    slug: "windows",
    name: "Windows",
    status: "Waitlist preview",
    summary: "The first planned desktop release. Explore the direction and try the waitlist preview.",
    overview: "Windows is the starting point for Voicela’s planned desktop experience: turn a spoken or typed request into a clear plan across supported apps, with a chance to review before acting.",
    points: [
      "First planned desktop release; no installer is available yet.",
      "The intended workflow puts review and user control before execution.",
      "System requirements and a release date have not been announced.",
    ],
  },
  {
    slug: "macos",
    name: "macOS",
    status: "Planned",
    summary: "A planned desktop experience for Mac, following Windows.",
    overview: "Voicela for macOS is planned after the initial Windows release. The direction is a voice-first layer for everyday Mac workflows, with supported integrations and permissions still to be determined.",
    points: [
      "Planned after Windows; no Mac app is available to download.",
      "Supported macOS releases and hardware have not been announced.",
      "App integrations and a release date are not yet confirmed.",
    ],
  },
  {
    slug: "linux",
    name: "Linux",
    status: "Planned",
    summary: "A planned Linux direction, with compatibility still under research.",
    overview: "Linux is on Voicela’s roadmap. Compatibility research will help determine the scope of a future desktop experience across distributions and desktop environments.",
    points: [
      "Planned; no Linux package or binary is available.",
      "Supported distributions and desktop environments are not yet confirmed.",
      "Packaging, system requirements and a release date remain undecided.",
    ],
  },
  {
    slug: "android",
    name: "Android",
    status: "Planned",
    summary: "A future mobile direction for Android. Scope is still being defined.",
    overview: "Voicela for Android is a planned mobile experience. How voice-led tasks fit phone workflows, permissions and supported integrations is still being explored.",
    points: [
      "Planned; no Android app or APK is available.",
      "Supported Android releases and devices have not been announced.",
      "Mobile features and a release date are not yet confirmed.",
    ],
  },
  {
    slug: "ios",
    name: "iOS",
    status: "Planned",
    summary: "A future mobile direction for iPhone. Scope is still being defined.",
    overview: "Voicela for iOS is planned as part of the mobile roadmap. The experience will need to work within iPhone permissions and supported integrations; its scope is not yet confirmed.",
    points: [
      "Planned; no iOS app or TestFlight build is available.",
      "Supported iOS releases and devices have not been announced.",
      "Mobile features and a release date are not yet confirmed.",
    ],
  },
] as const;

export function findPlatform(slug: string) {
  return platforms.find((platform) => platform.slug === slug);
}
