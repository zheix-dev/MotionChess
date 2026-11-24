# Publish Motion Chess free (browser-based)

This project is a Node.js website with Socket.IO multiplayer. It cannot be hosted as a plain static HTML page on GitHub Pages because accounts, matchmaking, and live multiplayer require a server.

## Free deployment using Render

1. Create a free account at https://render.com/ and a GitHub account at https://github.com/.
2. Create a new **public or private GitHub repository** and upload the *contents* of this `motion_chess_app` folder (the `server.js`, `package.json`, `public/`, `render.yaml`, and other files must be at the repository root).
3. In Render choose **New + → Blueprint** and connect that repository. Render detects `render.yaml`; select the free web service and deploy.
4. When deployment finishes, Render gives you an address similar to `https://motion-chess.onrender.com`. Open that address in Chrome. Players only need the URL; they do not install anything.
5. Share the URL with friends. They create accounts on the site and use Quick Match or private room codes.

## Important free-hosting limits

- Render's free service may sleep after inactivity, so the first visit after a quiet period can take a little while to wake up.
- The free service has an ephemeral filesystem. This starter app currently stores account/profile records in `data.json`, so records can be lost when the service restarts or redeploys. Do not use real/reused passwords. For durable public accounts, connect a free hosted PostgreSQL database and migrate the JSON store before relying on it.
- Active matches are held in server memory and end if the service restarts.
- Add an `OPENAI_API_KEY` environment variable in Render only if you want the hosted AI referee. Never put that key in browser JavaScript or commit it to GitHub. The local fallback referee works without it.
- A public URL means the site is reachable by anyone who has or discovers the URL; accounts are still required for online play. This beta is not yet hardened for a large public launch.

## Run locally (optional)

`npm install` then `npm start`, then visit `http://localhost:3000`.
