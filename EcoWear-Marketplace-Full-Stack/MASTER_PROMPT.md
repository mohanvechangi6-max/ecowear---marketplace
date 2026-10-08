# Master Prompt — EcoWear Marketplace

Build a production-ready full-stack application named **EcoWear Marketplace**, a Sustainable Fashion Resale & Repair Marketplace.

## Roles
1. Buyer — browse, search, purchase, bid, message sellers, book repairs, review purchases.
2. Seller — create/manage listings, manage orders, respond to buyers, run auctions.
3. Repair Partner — publish repair services, accept/manage repair bookings, update repair status.
4. Admin — moderate users/listings/reviews/messages, manage categories and platform operations.

## Core product
Create a polished, responsive marketplace for secondhand clothing. Each product should show:
- title, description, category, brand, size, color, material
- condition
- price
- photos
- seller
- AI authenticity score
- AI condition score
- sustainability impact score
- estimated water saved
- estimated CO2e saved
- listing status

## Required modules and API count
### Listing management — 7
POST /api/listings
GET /api/listings
GET /api/listings/:id
PUT /api/listings/:id
DELETE /api/listings/:id
PATCH /api/listings/:id/status
GET /api/sellers/:sellerId/listings

### AI condition/authenticity grading — 5
POST /api/ai/grade/:listingId
GET /api/ai/grade/:listingId
POST /api/ai/regrade/:listingId
GET /api/ai/history/:listingId
POST /api/ai/verify-authenticity/:listingId

### Search & filters — 5
GET /api/search
GET /api/search/suggestions
GET /api/categories
GET /api/brands
GET /api/filters

### Orders & payment — 7
POST /api/orders
GET /api/orders
GET /api/orders/:id
PATCH /api/orders/:id/status
POST /api/orders/:id/payment
POST /api/orders/:id/cancel
GET /api/orders/:id/invoice

### Repair booking — 6
GET /api/repair-services
POST /api/repair-services
GET /api/repair-services/:id
POST /api/repair-bookings
GET /api/repair-bookings
PATCH /api/repair-bookings/:id/status

### Sustainability impact — 4
GET /api/impact/listing/:listingId
GET /api/impact/order/:orderId
GET /api/impact/me
POST /api/impact/calculate

### Reviews & ratings — 4
POST /api/reviews
GET /api/reviews/listing/:listingId
PUT /api/reviews/:id
DELETE /api/reviews/:id

### Messaging — 6
POST /api/conversations
GET /api/conversations
GET /api/conversations/:id
POST /api/conversations/:id/messages
PATCH /api/messages/:id/read
DELETE /api/messages/:id

### Admin moderation — 5
GET /api/admin/dashboard
GET /api/admin/reports
POST /api/admin/reports
PATCH /api/admin/reports/:id
PATCH /api/admin/listings/:id/moderate

### Auction bidding — 5
POST /api/auctions
GET /api/auctions
GET /api/auctions/:id
POST /api/auctions/:id/bids
POST /api/auctions/:id/close

Total: **54 APIs**.

## Frontend requirements
Create pages:
- Home
- Browse/Search
- Product details
- Sell item
- Cart
- Checkout
- Orders
- Repair services
- Repair booking
- Messages
- Auctions
- Sustainability dashboard
- Seller dashboard
- Repair Partner dashboard
- Admin dashboard
- Login/Register

Use a clean eco-luxury visual system: cream backgrounds, forest green, muted earth tones, rounded cards, accessible contrast, mobile-first responsive layout. Add search, filters, product cards, status badges, sustainability metrics, loading/error/empty states, and protected role-based routes.

## Backend requirements
Use Express, Mongoose, JWT, bcryptjs, CORS and dotenv. Create models for User, Listing, Order, RepairService, RepairBooking, Review, Conversation, Message, Auction, Bid, Impact, AIGrade and Report. Add authentication middleware and role middleware.

AI grading must be implemented behind a service abstraction. The starter may use a deterministic demo grader, but production should allow plugging in an image/vision model.

Payment must be behind a payment service abstraction. The starter may create a demo payment intent, but production should support Stripe or Razorpay.

## Security
Hash passwords, validate IDs, enforce role permissions, never return password hashes, validate request bodies, use environment secrets, configure CORS, and never trust client-side prices or ownership.

## Deliverables
Return:
1. Complete frontend source
2. Complete backend source
3. .env.example files
4. MongoDB data models
5. 54 API implementations
6. README
7. API documentation
8. Seed/demo data
9. Tests
10. Deployment instructions
