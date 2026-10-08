# EcoWear API — 54 endpoint catalog

Auth:
- POST /api/auth/register
- POST /api/auth/login

The requested 54 business APIs:
1 POST /api/listings
2 GET /api/listings
3 GET /api/listings/:id
4 PUT /api/listings/:id
5 DELETE /api/listings/:id
6 PATCH /api/listings/:id/status
7 GET /api/sellers/:sellerId/listings
8 POST /api/ai/grade/:listingId
9 GET /api/ai/grade/:listingId
10 POST /api/ai/regrade/:listingId
11 GET /api/ai/history/:listingId
12 POST /api/ai/verify-authenticity/:listingId
13 GET /api/search
14 GET /api/search/suggestions
15 GET /api/categories
16 GET /api/brands
17 GET /api/filters
18 POST /api/orders
19 GET /api/orders
20 GET /api/orders/:id
21 PATCH /api/orders/:id/status
22 POST /api/orders/:id/payment
23 POST /api/orders/:id/cancel
24 GET /api/orders/:id/invoice
25 GET /api/repair-services
26 POST /api/repair-services
27 GET /api/repair-services/:id
28 POST /api/repair-bookings
29 GET /api/repair-bookings
30 PATCH /api/repair-bookings/:id/status
31 GET /api/impact/listing/:listingId
32 GET /api/impact/order/:orderId
33 GET /api/impact/me
34 POST /api/impact/calculate
35 POST /api/reviews
36 GET /api/reviews/listing/:listingId
37 PUT /api/reviews/:id
38 DELETE /api/reviews/:id
39 POST /api/conversations
40 GET /api/conversations
41 GET /api/conversations/:id
42 POST /api/conversations/:id/messages
43 PATCH /api/messages/:id/read
44 DELETE /api/messages/:id
45 GET /api/admin/dashboard
46 GET /api/admin/reports
47 POST /api/admin/reports
48 PATCH /api/admin/reports/:id
49 PATCH /api/admin/listings/:id/moderate
50 POST /api/auctions
51 GET /api/auctions
52 GET /api/auctions/:id
53 POST /api/auctions/:id/bids
54 POST /api/auctions/:id/close

## Search and filters

- `GET /api/search` accepts `q`, `category`, `brand`, `location`, `condition`, `size`, `color`, `material`, `minPrice`, `maxPrice`, and `sort` (`newest`, `price_asc`, or `price_desc`). Text queries search title, description, category, brand, location, size, color, and material. Results include the seller's public name and role and contain active listings only.
- `GET /api/search/suggestions?q=...` returns up to eight matching active-listing title suggestions with brand and category.
- `GET /api/categories` and `GET /api/brands` return sorted distinct values from active listings.
- `GET /api/filters` returns active-listing options for category, brand, location, condition, size, color, and material, plus the observed minimum and maximum listing prices.
- Invalid filter types, conditions, sort values, or price ranges return 400.

## Orders and payment

- `POST /api/orders` is buyer-only. It accepts `{ items: [{ listing, quantity: 1 }], shippingAddress: { name, line1, city, postalCode, country } }`. Prices and seller ownership are read from the database. A secondhand listing may appear once per order; all items in an order must belong to one seller.
- `GET /api/orders` returns the authenticated buyer's orders, the authenticated seller's orders, or all orders for an admin. `GET /api/orders/:id` and `GET /api/orders/:id/invoice` apply the same access rules.
- `PATCH /api/orders/:id/status` is seller/admin-only. Sellers can advance their own paid orders through processing, shipped, and delivered; admins can use the same forward transitions. Cancellation is handled only by the cancel endpoint.
- `POST /api/orders/:id/payment` is buyer-only and only accepts that buyer's pending order. The current payment adapter is a demo that immediately succeeds; successful payment marks the order paid and the listings sold.
- `POST /api/orders/:id/cancel` allows the buyer to cancel a pending order. Admins may also cancel paid or processing orders, which returns the associated sold listings to active.
- `GET /api/orders/:id/invoice` returns an invoice only after successful payment. Invalid IDs return 400; inaccessible or missing orders return 404.

## Sustainability impact

- `GET /api/impact/listing/:listingId` returns the listing's stored impact metrics, or clearly marked demo estimates derived from its price. Only active listings are public; owners can access their own non-active listings.
- `GET /api/impact/order/:orderId` is limited to the buyer, seller, or admin for that order and returns impact only for successfully paid, non-cancelled orders.
- `GET /api/impact/me` is buyer-only and summarizes that buyer's successfully paid, non-cancelled purchases, newest first.
- `POST /api/impact/calculate` accepts `{ "price": number }` and returns deterministic demo estimates with `estimated: true`. It does not create an authoritative impact record.
- Item impact values are snapshotted onto order items at order creation so later listing changes do not rewrite historic purchase impact.

## Repair services and bookings

- `GET /api/repair-services` and `GET /api/repair-services/:id` return active services publicly. Inactive services are hidden unless the caller is the owning partner or an admin.
- `POST /api/repair-services` requires a repair-partner or admin token and accepts `name`, `description`, `category`, `price`, `durationMinutes`, and `location`. The server assigns the partner and active state.
- `POST /api/repair-bookings` is buyer-only and requires an active service and a future `scheduledAt`; booking price and partner are copied from the service, not accepted from the client.
- `GET /api/repair-bookings` returns the current buyer's bookings, the current repair partner's bookings, or all bookings for an admin.
- `PATCH /api/repair-bookings/:id/status` permits only valid transitions: partners can confirm, start, and complete their own bookings; buyers can cancel their own requested bookings; admins can manage valid transitions.
- Invalid IDs, service fields, date values, and status transitions return explicit client errors; unauthorized access to another user's booking is returned as 404.

## Reviews and ratings

- `POST /api/reviews` is buyer-only and accepts `{ listing, rating, comment }`. The buyer must have a successfully paid, delivered order containing that listing. Each buyer may review a given listing once.
- `GET /api/reviews/listing/:listingId` returns `{ reviews, total, averageRating }`, with reviewer names and newest-first ordering.
- `PUT /api/reviews/:id` lets the review author update the integer rating (1–5) and non-empty comment (up to 2000 characters); admins may moderate/update reviews.
- `DELETE /api/reviews/:id` lets the review author or an admin delete the review. IDs and input fields are validated; unauthorized or missing reviews return 404.

## Messaging

- `POST /api/conversations` is buyer-only and accepts `{ listingId }` (optional `userId` must match the listing's seller). The server derives the seller from the active listing and reuses the conversation for that buyer/listing pair.
- `GET /api/conversations` returns only the authenticated user's conversations, latest message, and unread count.
- `GET /api/conversations/:id` returns messages oldest-first only to a participant.
- `POST /api/conversations/:id/messages` requires a participant and accepts non-empty `text` up to 4000 characters.
- `PATCH /api/messages/:id/read` lets the other conversation participant mark a message read; senders cannot mark their own message read.
- `DELETE /api/messages/:id` lets the message sender delete their own message, after verifying conversation participation.
- Invalid IDs or message input return 400; conversations outside the caller's membership are not exposed.

## Admin moderation

- `GET /api/admin/dashboard`, `GET /api/admin/reports`, `PATCH /api/admin/reports/:id`, and `PATCH /api/admin/listings/:id/moderate` require an admin token.
- `POST /api/admin/reports` is available to authenticated users and accepts `{ targetType, targetId, reason, details? }`; supported targets are `listing`, `user`, `review`, `message`, and `conversation`. Reporter and initial `open` status are assigned by the server.
- The dashboard reports user/listing/order totals and open, reviewing, and closed report counts. Reports include a limited target preview and reporter name.
- Admins can transition reports from open to reviewing/resolved/rejected or reopen a reviewing report; resolved and rejected reports are terminal.
- Listing moderation accepts only `active`, `paused`, or `rejected`; sold listings cannot be changed by moderation. IDs, fields, and status transitions are validated.

## AI grading

- `POST /api/ai/grade/:listingId` requires the listing owner (seller) or an admin. It creates a demo grade if none exists and otherwise returns the latest grade.
- `GET /api/ai/grade/:listingId` returns the latest grade. Active listing grades are public; non-active listings require the owner or an admin.
- `POST /api/ai/regrade/:listingId` requires the owner or an admin and creates a new grade-history record.
- `GET /api/ai/history/:listingId` returns grades newest-first, subject to the same listing visibility rules as the current grade.
- `POST /api/ai/verify-authenticity/:listingId` requires the owner or an admin, creates a fresh grade, and returns `{ verified, score, grade }`. The current demo grader is deterministic and is not a production authenticity guarantee.

## Auctions

- `POST /api/auctions` requires a seller or admin and accepts only `{ listing, startingBid, endsAt }`. The listing must be active and not already auction-reserved; sellers may auction only their own listings. The listing is paused and reserved when the auction is created.
- `GET /api/auctions` returns active, unexpired auctions. `GET /api/auctions/:id` returns auction details and up to 20 highest bids; expired auctions are closed automatically when read.
- `POST /api/auctions/:id/bids` is buyer-only and accepts `{ amount }`. Bids must be positive, exceed the current bid, arrive before expiry, and cannot be placed by the seller. The bid update is conditional to prevent simultaneous bids from overwriting a higher bid.
- `POST /api/auctions/:id/close` lets the owner close an expired auction; admins may close auctions at any time. The highest bidder becomes winner. If there are no bids, the listing is returned to active status.
- Winning auctions record a winner but do not charge them or create an order: settlement is not part of the provided auction endpoints. Winning listings remain reserved pending a future settlement flow. Auction-reserved listings cannot be purchased through regular checkout.

All protected endpoints expect:
Authorization: Bearer <JWT>
