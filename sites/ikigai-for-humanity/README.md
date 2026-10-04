# Ikigai for Humanity

This ChatGPT Site adapts the original game in the parent workspace for 2–8 players on separate devices. Its 400 activity cards, four categories, Quick/Deep/Custom modes and one-device game remain intact.

Host a room and share its link. Players build their decks together, then write ideas for the active player at the same time. With three or more players, only the active player sees the shuffled anonymous ideas before choosing a path. Two-player rooms use direct reflection. Players can keep any number of ideas and retain the rest in their idea bank.

## Running locally

Install and build with the Sites plugin helpers. The project uses the supplied Vinext starter, Cloudflare Workers and the Sites-managed D1 DB binding.

`npm run dev` starts the local preview. Apply the checked-in Drizzle migration to its local database before testing room actions. Follow the Sites skill for the exact migration and publishing commands.

## Source

- `app/game.html` and `app/route.ts` serve the original HTML shell.
- `public/` holds the original card deck, shared game definitions, one-device game, room UI and styles.
- `app/api/rooms/route.ts` handles same-origin room requests using HttpOnly browser sessions.
- `lib/room-engine.mjs` validates actions, hides private data and defines game transitions.
- `lib/room-store.mjs` stores large rooms in bounded chunks with atomic updates.
- `db/schema.ts` and `drizzle/` define storage. Publishing applies the hosted migration.

Room data expires 30 days after creation. Unfinished writing stays in the player's browser. Players should use the same browser to reconnect, and copy the final recap if they want to keep it longer. Clearing browser cookies loses that browser's seat.

## Verification

Run the Node tests with `node --test --test-isolation=none tests/*.test.mjs`.

`node tests/http-smoke.mjs http://127.0.0.1:5173` plays a complete three-player game through the real API. It checks separate browser sessions, simultaneous submissions, role checks, anonymous voting, duplicate requests and the complete recap. It creates only a synthetic test room.

The site identity is recorded in `.openai/hosting.json`. Use Sites source synchronization and saved-version deployment for updates. The parent app remains unchanged.
