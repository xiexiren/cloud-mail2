# Cloudflare assets.directory build fix

The frontend now always builds to `mail-vue/dist`, while every Wrangler config reads static assets from `../mail-vue/dist`.

## Why

`assets.directory` is resolved relative to the Wrangler configuration file in `mail-worker/`. The previous configuration expected `mail-worker/dist`, while the Cloudflare build produced a frontend `dist` directory under `mail-vue/`.

## Changes

- `mail-vue/vite.config.js`: fixed `build.outDir` to `dist`.
- `mail-vue/.env.release`: removed cross-project `VITE_OUT_DIR`.
- all `mail-worker/wrangler*.toml`: `assets.directory = "../mail-vue/dist"`.
- all Wrangler configs now use `[build].cwd = "../mail-vue"` and run `pnpm install --frozen-lockfile && pnpm run build`.

## Cloudflare Workers Builds

Recommended root directory: `mail-worker`

Recommended deploy command: `pnpm wrangler deploy`

You do not need a separate frontend build command in the Cloudflare dashboard because Wrangler's custom build runs it before deploy. If you keep a dashboard build command, avoid duplicating the same frontend build.
