Render deployment guide
----------------------

1) Connect repository
   - Log in to Render and create a new Web Service.
   - Connect your GitHub repository for this project and select the `main` branch.

2) Build & start
   - Render will run `npm install` (see `render.yaml`) and use `node server.js` to start.

3) Required environment variables (set in Render > Service > Environment):
   - `MONGODB_URI` — MongoDB Atlas connection string (mongodb+srv://...)
   - `JWT_SECRET` — secure random secret for signing JWTs
   - `FRONTEND_BASE` or `ALLOWED_ORIGIN` — URL of frontend to allow CORS (optional in dev)
   - `DISABLE_SIGNUP` — set to `true` to disable programmatic signup
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` / `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` — optional

4) Migration
   - After `MONGODB_URI` is set, run migration locally or via Render shell:

```
# locally, in project root
MONGODB_URI="<your-uri>" npm run migrate
```

5) Verify
   - Visit `<service-url>/auth/verify` with a valid token, or use the seeded dev user (username: `test`, password: `password`) in non-production to log in and confirm tasks load.

6) Notes
   - Do NOT commit secrets to repo. Use Render's dashboard to add environment variables.
   - If you prefer Railway, the same env vars apply and the migration step is identical.
