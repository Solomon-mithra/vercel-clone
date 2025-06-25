# Vercel "Clone & Deploy" Microservices
**Technologies & Frameworks:**  
`TypeScript` • `Node.js` • `Express` • `Redis` • `AWS SDK` • `Cloudflare R2` • `React` • `Vite` • `Tailwind CSS` • `Axios`

This workspace contains four parts:

1. **vercel-upload-service** (Port 3000)
   - Endpoint: POST `/deploy` & GET `/status`
   - Clones a GitHub repo, uploads all files to S3 (Cloudflare R2), and enqueues the build job in Redis.
   - Workflow:
     1. Receive repository URL in POST body.
     2. Clone into `output/{id}`.
     3. Upload each file under the `output/{id}` prefix.
     4. Set Redis status to `uploaded` and push ID into the `build-queue` list.
     5. Respond with `{ id, message }`.

2. **vercel-deploy-service** (Worker)
   - No HTTP interface; runs as a background worker.
   - Listens on Redis `build-queue`, then for each ID:
     1. Download files from S3 (prefix `output/{id}`) to local `t/{id}` folder.
     2. Run `npm install && npm run build` inside `t/{id}`.
     3. Copy the built `dist` folder back into S3 under `dist/{id}/...`.
     4. Update Redis status to `deployed`.

3. **vercel-request-handler** (Port 3001)
   - Serves files from `dist/{id}` in S3 via HTTP.
   - Uses the incoming host header (`{id}.solo.com`) to select which site to serve.
   - Example: GET `/index.html` on host `myid.solo.com` returns object `dist/myid/index.html`.

4. **frontend** (Vite + React)
   - UI for entering a GitHub URL and kicking off a deployment.
   - Polls the `/status?id={id}` endpoint until status is `deployed`, then shows a link.

## Prerequisites
- Node.js >= 18
- Redis server running locally on default port
- AWS/R2 credentials in a `.env` file at each service root:
  ```
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_ENDPOINT=https://<your-r2-endpoint>
  AWS_BUCKET=vercel
  AWS_REGION=auto
  ```
- Install dependencies in each folder:
  ```bash
  cd vercel-upload-service && npm install
  cd ../vercel-deploy-service && npm install
  cd ../vercel-request-handler && npm install
  cd ../frontend && npm install
  ```

## Running Locally
1. Start Redis.
2. In `vercel-upload-service`: `npm run dev` (port 3000)
3. In `vercel-deploy-service`: `npm run dev` (worker loop)
4. In `vercel-request-handler`: `npm run dev` (port 3001)
5. In `frontend`: `npm run dev` (opens at http://localhost:5173)

## Hosts File Setup
To preview deployed sites by hostname (`{id}.solo.com`), add an entry to `/etc/hosts`:

```bash
sudo vi /etc/hosts
# add line:
127.0.0.1    exampleid.solo.com
```

Then, after deployment is `deployed`, visit:

```
http://exampleid.solo.com:3001/index.html
```

You can repeat the hosts entry for any new `{id}` returned by the upload service.
