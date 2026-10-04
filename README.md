# Ikigai for Humanity

[Play Ikigai for Humanity](https://ikigai-for-humanity.marcusgohtx.chatgpt.site/).

The multiplayer game is hosted on ChatGPT Sites. GitHub Pages redirects players to it, preserving room links and URL fragments.

The original static game source remains in `public/`. Its entry page redirects to the hosted game. Keep the original localStorage keys and room URL parameters compatible.

Run `npm run lint` and `npm run build` before publishing. GitHub Actions deploys the `out/` folder to GitHub Pages on pushes to `main`.
