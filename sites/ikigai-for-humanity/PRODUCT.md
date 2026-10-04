# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Groups of 2–8 friends, each playing on their own phone or computer.

## Product purpose

Ikigai for Humanity helps friends imagine career ideas for one another using four categories of activity cards. A completed game gives each person ideas to keep exploring.

## Operating context

The host shares a room link. Players choose or write activity cards concurrently. On each turn, friends write ideas for one active player, who chooses a path and saves any ideas they want to explore. Everyone receives a turn.

## Capabilities and constraints

- Public ChatGPT Site with private room membership and server-checked actions.
- Keep the 400-card deck, four Ikigai categories, anonymous ideas for groups of three or more, and saved recap.
- Remove the one-device option. The requested interface should use far fewer words.
- Every game starts with one round, meaning one turn per player. After each round, the host chooses Keep playing or Stop playing. Round counts do not appear in setup.
- Stop playing reveals the player with the most votes. Score accumulation and ties are being confirmed.
- Room data remains available for 30 days.

## Brand commitments

The new name is Ikigai for Humanity, with ikigai-for-humanity used for the app folder, GitHub repository and ChatGPT Site slug. The user named Cards Against Humanity as inspiration. No affiliation is claimed.

## Evidence on hand

The existing deck and game definitions are in public/cards.js and public/game-core.js. The live room flow is in public/room.js. Existing server tests cover multiplayer, privacy and persistence.

## Product principles

- Let players act with minimal reading.
- Keep friends on separate devices in the same room.
- Preserve meaningful choices and make the next action clear.
