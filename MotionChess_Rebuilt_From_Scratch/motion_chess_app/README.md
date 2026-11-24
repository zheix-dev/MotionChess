# Motion Chess — clean rebuild

This is a fresh implementation, not a patch over the previous interface.

## Run locally

1. Install Node.js 20 or newer.
2. Extract this folder.
3. Open a terminal inside `motion_chess_app`.
4. Run `npm install`.
5. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` plus a long random `AUTH_SECRET`.
6. Run `npm start` and open `http://localhost:3000`.

The AI referee deliberately has **no local fake fallback**. Without `OPENAI_API_KEY`, the app reports that the referee is unavailable. The key belongs only in the server environment (Render → Environment), never in browser code or GitHub.

## Implemented in this rebuild

- New responsive dark chess interface and account screens.
- Server-side account authentication and session tokens.
- Standard chess legality enforced by `chess.js` on the server.
- Practice opponent, online quick-match queue, and private room codes.
- AI referee through the OpenAI Responses API with strict structured output.
- Clarification turns retain the original conversation and send it back to the referee.
- Explicit confirmation before the D20 roll; roll is generated on the server.
- Executable, server-interpreted motion effects: `pawn_surge`, `ward`, and `freeze`.
- Match event log, active effects, and basic profile counters.

## Important scope boundary

This is a working rebuilt foundation, not a claim that every imaginable natural-language mechanic is supported. The AI must select from the implemented effect engine; it cannot safely invent and execute arbitrary JavaScript. The current build does not yet implement custom piece movement, summon/transform systems, full visual effect timelines, king survival/resummoning rules, spectators, persistent database storage, production-grade anti-cheat/rate limiting, or adaptive bot play under altered rules. Unsupported mechanics should be clarified or rejected rather than falsely reported as executed.

## Deployment on Render

- Create a Node web service from the GitHub repository.
- Upload the contents of this project folder directly into the repository root so `package.json` and `server.js` are at the top level.
- Root directory: leave blank.
- Build command: `npm install`
- Start command: `npm start`
- Add `OPENAI_API_KEY`, `OPENAI_MODEL` (optional), and `AUTH_SECRET` in Render Environment.
- Deploy. Check `/api/health` to verify `aiConfigured: true`.

Accounts and matches in this starter are in-memory and reset when the server restarts. Add a database before treating this as a production service.
