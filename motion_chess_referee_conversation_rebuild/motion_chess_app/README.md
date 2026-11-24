# Motion Chess — online beta build

A self-hosted web app for Motion Chess. It now includes local practice, account registration/sign-in, online matchmaking, private room codes, configurable custom-room time-control settings, live board synchronization, spectators, profile statistics, match records, light/dark appearance, AI motion adjudication, D20 rolls, and an executable pawn-Rumbling rule.

## Run on Windows
1. Install Node.js 18 or newer.
2. Extract the ZIP.
3. Open the `motion_chess_app` folder. Click the File Explorer address bar, type `cmd`, and press Enter.
4. Run `npm install` and wait until it finishes.
5. Optional: copy `.env.example` to `.env`, add an OpenAI API key, and set a long random `AUTH_SECRET`.
6. Run `npm start`.
7. Visit `http://localhost:3000`.

## Accounts and online play
- Select **Account / Online** and create an account (username 3–18 characters; password at least 8 characters).
- **Quick Match** pairs two connected users.
- **Create Private Match** creates a room code to share with a friend.
- **Custom Match** asks for a base+increment time-control label and whether motions are allowed.
- **Join** enters a private room code.
- **Watch Matches** lists active games and joins one as a spectator.
- Disconnecting during an active match forfeits that match.
- Profile statistics and recent match records are stored in `data.json`.

## Motion referee and rule execution
- With `OPENAI_API_KEY`, the server asks the configured OpenAI model to clarify and judge motions using a strict structured response.
- Without a key, the built-in deterministic referee is used. It calibrates the board-wide pawn Rumbling example at 13+ for one square and 16+ for four squares; magnitude is not ignored.
- A successful supported pawn-Rumbling motion immediately advances the player's pawns by the specified distance, captures non-king pieces in the path, and remains active on that player's later turns.
- The opposing king is never directly captured by this effect.
- Other imaginative motions can be proposed and judged, but are recorded rather than executed unless a corresponding safe effect implementation exists. The AI is not permitted to emit arbitrary executable code.

## Deployment for internet multiplayer
This package is a self-hosted application, not a hosted service. To play across the internet, deploy the Node server to a host that supports persistent Node processes and WebSockets (Socket.IO), configure HTTPS, `AUTH_SECRET`, and optionally `OPENAI_API_KEY`, and use persistent storage for `data.json`. The default JSON-file database is suitable for a small beta, not high-traffic production; use a transactional database before public launch. Localhost is only accessible from the same computer unless you deploy or configure network access.

## Current beta limitations (important)
This is a substantially expanded playable beta, not a fully finished commercial game. The current board remains 8×8 and uses standard chess legality for ordinary moves. Custom piece creation, arbitrary board geometry/environment transformations, general-purpose motion execution, king recovery after capture, bonus motion charges, post-match AI creativity adjudication, animated custom assets, robust reconnect/resume, anti-cheat/rate limiting, and production-grade database migrations are not yet complete. The simple practice bot is not a strong chess AI. The custom time-control value is stored and the server tracks clock values, but a full visible ticking clock/timeout adjudication is still to be completed.

Never expose your OpenAI API key in browser code. Change the default `AUTH_SECRET` before deploying publicly.

## Free public website deployment

See [`DEPLOY_FREE.md`](DEPLOY_FREE.md). A `render.yaml` Blueprint is included for a free Render web service. After deployment, visitors use the Render URL in their browser; they do not download or install the project. Free hosting can sleep when idle and this beta's JSON account database is not durable across restarts, so migrate to a hosted database before treating it as a permanent public service.

## Newly added in this build

- Dedicated full-page player profile with statistics and recent online match history.
- A **Play vs Bot** button with Easy, Normal, and Hard local bot settings.
- Offline bot practice can use the built-in motion referee without requiring an account or server API key.

## AI-generated motion programs (experimental foundation)

The referee response can now include an `effectCode` JavaScript function expression and an `animationPlan`. Successful online rolls pass the generated program to `motion-runtime.js`, which exposes a deliberately small capability API (`addRule`, `createEntity`, `setSquareEffect`, `animate`, `setVariable`, and `log`) and applies size, operation-count, and execution-time limits. Runtime state is attached to the match and sent to clients. This is an extensible prototype foundation, not a completed arbitrary-rules engine: created entities and square effects are recorded as runtime state, but they are not yet fully integrated into chess.js legal move generation, collision resolution, persistence, or the frontend animation renderer.

**Security warning:** Node's built-in `vm` module is not a security boundary. Do not expose arbitrary AI-generated JavaScript execution to an untrusted public audience in production. Before enabling this feature for public matches, move execution into a separately isolated worker/container or a hardened isolate service with strict resource and capability limits. The current runtime is experimental defense-in-depth only.

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the hosting provider's environment settings. Never commit API keys to GitHub. Without a key, the local/demo referee does not generate executable motion programs.


## Referee conversation and dice-state repair (experimental)
- The motion evaluation request now accepts a bounded clarification transcript and sends it to the AI referee on every reevaluation.
- Clarification UI asks one focused question per round and retains prior referee/player messages in the next request.
- The referee endpoint fails explicitly when OPENAI_API_KEY is missing or the provider request fails; it does not present the local demo estimate as an AI result.
- The D20 confirmation handler explicitly unlocks the roll button and the click handler independently checks the confirmed proposal state.
- `node --check` passed for server.js, public/app.js, and motion-runtime.js.

## Important limitations
This is not yet a finished "limitless" game engine. The current executable motion API is a restricted prototype and does not yet implement arbitrary chess movement overrides, full collision/trigger resolution, all generated entity behaviors, arbitrary visual rendering, reconnect-safe multiplayer transactions, or AI creativity scoring. The Node VM runtime must not be treated as a security sandbox for untrusted code; production arbitrary-code execution requires a separate isolated worker/container with strict resource and capability limits. Do not expose unrestricted generated code to public matches.
