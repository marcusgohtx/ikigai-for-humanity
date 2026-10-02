# Ikigai: Make a Life

Standalone browser game extracted from marcusgohtx.github.io, including the latest local game and multiplayer changes.

## Development

Run `npm run dev` and open http://localhost:3001. There are no npm dependencies.

Run `npm run lint` and `npm run build` to validate and export to `out/`.

## Hosting

Enable GitHub Pages with GitHub Actions as the source. Push to main to deploy. Static assets use relative paths, so the game works under `/ikigai/`.

Multiplayer continues to use the existing Supabase project configured in `public/room-config.js`. Its client configuration is public; server-side row policies and RPC permissions control access. No backend migration is included.

Browser storage keys and `?room=` invitation links are preserved. The personal website provides redirects for old game URLs.
