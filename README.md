# T-RX Runner Multiplayer

**The Chrome dino game, multiplayer: 2-4 players, live progress bars, one room code.**

**[▶ Play now](https://thomaszhou22.github.io/trex-multiplayer/)**

[English](./README.md) | [中文](./README_CN.md)

---

Every player runs their own full game locally; only scores and alive/dead status are relayed. The HUD shows every player's progress bar and score in real time — dead players gray out and get struck through. Works on LAN or across the internet.

Game assets extracted from the Chrome offline easter egg (via [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner), BSD-licensed Chromium source). Multiplayer layer added without touching a single line of game code.

## How to play

1. Open the game page (GitHub Pages link below)
2. Enter a room code (any word, share it with friends)
3. Point the server field at a relay URL (see below)
4. Press Space and run. Everyone in the room sees everyone's progress.

## Architecture

```
Browser (full game, local)  ──score/alive every 500ms──►  WebSocket relay  ──broadcast──►  All browsers
```

- **No frame sync needed.** Each client renders its own game; only state summaries travel. Latency is irrelevant.
- **Zero game-code edits.** `net.js` is a bypass observer reading the Runner instance; the original 2752-line game file is untouched.
- **Rooms hold up to 4 players**, auto-reject a 5th, prune players stale for 10s, and auto-rejoin clients whose heartbeat resumed after background-tab throttling.

## Files

```
├── index.html     # Game page + multiplayer HUD
├── game.js        # Original t-rex-runner (unmodified Chromium source)
├── game.css       # Original styles
├── net.js         # Multiplayer client: observer + HUD renderer
├── server.js      # WebSocket relay (Node.js, ws)
└── assets/        # Sprites extracted from Chrome
```

## Deploy the relay (free)

Works on Render.com / Railway / Fly.io free tiers:

```bash
git clone https://github.com/Thomaszhou22/trex-multiplayer.git
cd trex-multiplayer && npm install
npm start   # listens on $PORT or 8080
```

On Render: New Web Service → connect the repo → start command `npm start`. You get a `wss://xxx.onrender.com` URL — paste it into the game's server field. For LAN-only play, run `npm start` on any machine and use `ws://<lan-ip>:8080`.

## Play locally

```bash
npm install && npm start          # relay on :8080
python3 -m http.server 8765       # static host
# open http://localhost:8765, room code anything, server ws://localhost:8080
```

## Verified

- Two simulated clients: join broadcast, score update (321), death propagation — correct
- Idle player stays in room past the 10s prune window (heartbeat decoupled from game state)
- Background-tab throttling auto-rejoin regression — pass

## License

MIT for multiplayer code (`net.js`, `server.js`, `index.html`). Game code and assets are BSD-licensed Chromium source via wayou/t-rex-runner; Google retains its rights to those assets — fine for personal/educational use, swap assets before any commercial deployment.
