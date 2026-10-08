# EcoWear Marketplace

Sustainable Fashion Resale & Repair Marketplace built with:
- Frontend: React + Vite + React Router
- Backend: Node.js + Express + MongoDB/Mongoose
- Authentication: JWT
- Roles: Buyer, Seller, Repair Partner, Admin
- AI grading: pluggable service with deterministic demo fallback
- Modules: listings, AI grading, search, orders/payments, repair booking, impact scoring, reviews, messaging, moderation, auctions
- API catalog: 54 endpoints

## Listing management

- Sellers and admins can create listings. Seller ownership is assigned by the server, and clients cannot set AI grades, impact values, or initial status.
- Public listing queries expose active listings; sellers can also see their own non-active listings.
- Sellers can update, delete, and change status only for their own listings. Seller status changes are limited to `draft`, `active`, and `paused`; admins can also set `sold` and `rejected`.
- Listing updates accept the garment fields `title`, `description`, `category`, `brand`, `location`, `size`, `color`, `material`, `condition`, `price`, and `images`. Location is an optional city or region (up to 120 characters) and is available as a browse filter.

## Quick start

### 1. Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```
Set `MONGODB_URI`, `CLIENT_URL`, and a unique `JWT_SECRET` of at least 32 characters in `.env`. Generate a development secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. The server refuses to start without a sufficiently long JWT secret.

To add demo data to a disposable development database, stop the API, set `DEMO_PASSWORD` in `backend/.env` (or use the documented local-only default), and run `npm run seed`. Seeding is repeatable and only inserts missing demo records; it does not clear existing collections. The seed command refuses to run when `NODE_ENV=production`.

### 2. Frontend
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend default: http://localhost:5173
Backend default: http://localhost:5000

## Demo accounts
After running the seed command, the local demo accounts are `seller@ecowear.demo`, `buyer@ecowear.demo`, `repair@ecowear.demo`, and `admin@ecowear.demo`; they share the configured `DEMO_PASSWORD` (default `Demo@12345`). Use these accounts only in a disposable local database and never deploy the default demo password. Register through the UI for non-demo accounts. For local development only, an admin can be created by temporarily setting `ALLOW_ADMIN_REGISTER=true` in backend `.env`; public admin registration is disabled in production.

## Automated tests
Run the backend unit and schema tests with:
```bash
cd backend
npm test
```
These tests use Node's built-in test runner and do not require MongoDB. The production frontend build can be verified with `cd frontend && npm run build`.

## Deployment

The repository can be deployed as a Node web service and a static frontend. The example below uses MongoDB Atlas, Render, and Vercel; equivalent hosts can be used if the same environment and SPA routing requirements are met.

### 1. Prepare MongoDB Atlas
1. Create a production cluster and a database user with access only to the EcoWear database.
2. Set Atlas network access to the backend host's outbound IP range where supported. Avoid `0.0.0.0/0` unless the host requires it; use a strong database password and TLS.
3. Copy the Atlas SRV connection string. URL-encode special characters in the database username/password and use a database-specific path, for example `...mongodb.net/ecowear`.

### 2. Deploy the backend to Render
1. Create a **Web Service** from the repository. Set **Root Directory** to `backend`, **Build Command** to `npm ci`, and **Start Command** to `npm start`.
2. Configure these environment variables in the Render dashboard (never commit them):
   - `NODE_ENV=production`
   - `PORT` is supplied by Render; do not hard-code it.
   - `MONGODB_URI` to the Atlas connection string.
   - `JWT_SECRET` to a newly generated random value of at least 32 characters.
   - `CLIENT_URL` to the exact deployed frontend origin, such as `https://your-ecowear-app.vercel.app` (no path; comma-separated exact origins are supported).
   - `ALLOW_ADMIN_REGISTER=false`
   - `AI_GRADER_PROVIDER` and `PAYMENT_PROVIDER` to registered production adapters. Do not rely on the demo payment adapter for real orders: it simulates successful payment. Do not advertise AI demo scores as actual authenticity verification.
3. Configure the service health check path as `/api/health`. Confirm it returns `{"ok":true,"service":"EcoWear API"}`.
4. Do not run `npm run seed` against production. Create the first admin through a controlled database operation or a separately secured, one-time administrative provisioning process.

### 3. Deploy the frontend to Vercel
1. Import the repository and set **Root Directory** to `frontend`, **Framework Preset** to Vite, **Build Command** to `npm run build`, and **Output Directory** to `dist`.
2. Add `VITE_API_URL` with the deployed backend API base URL, for example `https://your-ecowear-api.onrender.com/api`.
3. Deploy and verify direct navigation/reload on `/browse`, `/auctions`, and a product route. [vercel.json](./frontend/vercel.json) configures the SPA fallback for client-side routes.
4. Set the backend `CLIENT_URL` to the exact final Vercel origin, redeploy/restart the backend, and confirm browser API requests succeed without CORS errors.

### 4. Production smoke checks
- Register a buyer and seller, verify protected routes and cross-account authorization, and confirm password fields never appear in responses.
- Test listing creation, search, order totals derived from stored listing prices, and repair booking with non-owner credentials.
- Verify the production payment adapter against provider test credentials and webhooks before enabling payments. Current API payment handling expects a provider adapter to return a verified synchronous success, so asynchronous provider settlement needs an adapter/API extension before use.
- Check database backups, logs, frontend deep links, and the `/api/health` endpoint after each deployment.

## Production notes
- User password hashes are excluded from normal database reads and removed from serialized user documents. Authenticated and optional-auth requests verify the current user and role; invalid supplied tokens are rejected rather than treated as anonymous. API handlers validate IDs and accepted request fields, while assigning owners, prices, and state from trusted server data.
- Set `NODE_ENV=production`, a private `JWT_SECRET`, `MONGODB_URI`, and exact comma-separated HTTP(S) `CLIENT_URL` origins. Wildcard origins and public admin registration are not permitted in production.
- AI grading and payment are provider boundaries in `backend/src/services`. The default `demo` implementations remain deterministic and use no external AI/payment credentials.
- Set `AI_GRADER_PROVIDER` and `PAYMENT_PROVIDER` in `backend/.env` to the name of a registered adapter. Implement a production adapter with the same function contract, register it using `registerAIGrader(name, grader)` or `registerPaymentProvider(name, createPaymentIntent)`, and load/register it from backend startup before accepting requests. AI graders receive the listing document and return condition/authenticity scores, labels, confidence, and notes. Payment adapters receive an order and must return a successful result with provider transaction ID and exact order amount; the current order API expects synchronous success. Stripe/Razorpay adapters should keep secret keys on the server and verify provider payment before returning success.
- Add object storage (S3/Cloudinary) for product images.
- Add Redis/socket.io for production messaging and auction realtime updates.
- Add rate limiting, audit logging, email/SMS notifications, CSRF protections, and automated tests.
