# Voicela

Install Node.js 24 LTS and pnpm 11.5.2, then run `pnpm install` from the repository root.

## Commands

Run these from the repository root:

| Command | What it does |
| --- | --- |
| `pnpm tauri dev` | Run the core desktop app with hot reload |
| `pnpm tauri build` | Build only the native app and installers |
| `pnpm web dev` | Run the website at http://localhost:3000 |
| `pnpm web build` | Build only the website |
| `pnpm web start` | Serve the production website after building it |
| `pnpm build` | Build the website, then the native app and installers |
| `pnpm lint` | Check the website with ESLint |
| `pnpm speech:setup` | Prepare the desktop speech runtime and model |

`pnpm dev` is also a shortcut for `pnpm tauri dev`.

The desktop app requires the Rust MSVC toolchain, Visual Studio C++ Build Tools, and Microsoft Edge WebView2 Runtime. Its first dev/build run downloads and verifies the local speech runtime and model (about 190 MB). See [the app guide](apps/app/README.md) for details.

## Structure

```text
apps/
  app/                 Desktop product (Tauri + React + Rust)
    src/               Desktop interface and features
    src-tauri/         Native backend, resources, and installer config
    scripts/           Speech setup tooling
  web/                 Website (Next.js)
    app/               Website pages and API routes
    components/        Website components
    lib/               Website utilities
    public/            Website assets
```

Each app owns its dependencies and configuration. The root holds workspace commands and one shared `pnpm-lock.yaml`. Use pnpm throughout; CI installs with `pnpm install --frozen-lockfile`.

Website environment files belong in `apps/web/`. Local waitlist data lives in `apps/web/data/`. Website output goes to `apps/web/.next/`; native bundles go to `apps/app/src-tauri/target/release/bundle/`.

For a desktop frontend build without compiling Rust or packaging installers, run `pnpm --filter @voicela/app build`.
