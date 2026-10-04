# Ikigai for Humanity

Play with 2–8 friends, each on their own device. The game keeps the original 400 activity cards, four Ikigai categories and pastel design. The home screen offers Host and Join. Optional card settings are under Game options.

Host a room and share its link. Players build their decks together, then write ideas for the active player at the same time. With three or more players, only the active player sees the shuffled anonymous ideas before choosing a path. Two-player rooms use direct reflection. Players can keep any number of ideas and retain the rest in their idea bank.

## Running locally

Install and build with the Sites plugin helpers. The project uses the supplied Vinext starter, Cloudflare Workers and the Sites-managed D1 DB binding.

`npm run dev` starts the local preview. Apply the checked-in Drizzle migration to its local database before testing room actions. Follow the Sites skill for the exact migration and publishing commands.

## Source

- `app/game.html` and `app/route.ts` serve the original HTML shell.
- `public/cards.js`, `public/game-core.js`, `public/room.js` and `public/game.css` provide the deck, shared definitions, multiplayer interface and styles. The legacy `app.js` and `styles.css` remain as source reference and are not loaded.
- `app/api/rooms/route.ts` handles same-origin room requests using HttpOnly browser sessions.
- `lib/room-engine.mjs` validates actions, hides private data and defines game transitions.
- `lib/room-store.mjs` stores large rooms in bounded chunks with atomic updates.
- `db/schema.ts` and `drizzle/` define storage. Publishing applies the hosted migration.

Room data expires 30 days after creation. Unfinished writing stays in the player's browser. Players should use the same browser to reconnect, and copy the final recap if they want to keep it longer. Clearing browser cookies loses that browser's seat.

## Verification

Run the Node tests with `node --test --test-isolation=none tests/*.test.mjs`.

`node tests/http-smoke.mjs http://127.0.0.1:5173` plays a complete three-player game through the real API. It checks separate browser sessions, simultaneous submissions, role checks, anonymous voting, duplicate requests and the complete recap. It creates only a synthetic test room.

The site identity is recorded in `.openai/hosting.json`. Use Sites source synchronization and saved-version deployment for updates. The canonical GitHub source is in `marcusgohtx.github.io/ikigai-for-humanity/sites/ikigai-for-humanity`. The ignored `.sites-publish/` directory at the repository root holds the separate Sites source checkout. Synchronize canonical source into that checkout before publishing; keep its Git history separate.

Every game starts with one round, giving each player one turn. After each round, only the host chooses Keep playing or Stop playing. Continuing reuses the existing activity cards. Each chosen idea earns its author one vote across all rounds; keeping other ideas does not add votes. Scores stay hidden until Stop playing reveals the leaders. Tied leaders share the win, and the full idea recap remains available.

Existing active rooms pause at their next full-round boundary, regardless of their old round setting. Completed rooms stay complete with their recaps intact. Round decisions are attached to the completed turn so retries cannot advance a later round. Room storage remains chunked as continued rounds add ideas, and the existing 30-day expiry still applies.
