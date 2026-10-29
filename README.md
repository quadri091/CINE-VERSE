# CineVerse Backend

Express + MongoDB + Socket.IO + Paystack for the Cine Verse app.
Movies are **scheduled live screenings**: everyone watches from `startTime`, like TV.

## Run

```
npm install
cp .env.example .env              # fill it in
npm run dev                       # local, restarts on save (nodemon)
npm start                         # production (node index.js)
npm run make-admin -- you@mail.com   # makes that account an admin
```

Movies are added from the admin app (Movies → Add movie).

Production `.env` must have `SERVER_URL` (your https address, used for the email logo
and the Paystack callback) and a long random `jwtSecretKey`.

## Folders

| Folder | What |
|---|---|
| `models/` | user, movie, ticket, payment, notification, support |
| `controllers/` | the logic, one file per area |
| `routes/` | only wires `router.method(path, middleware, controller)` |
| `middleware/` | `auth.js` (Bearer token → `req.user`), `role.js` (`role("admin")`) |
| `utils/` | email templates, Paystack, uploads (Cloudinary), notify, helpers |
| `jobs/movieTimer.js` | every minute: "starts in 15 min" + "is now live" notifications |
| `socket.js` | live connection, rooms `user:<id>`, `admins`, `movie:<id>` |

Every response is `{ success, message, data }`.

## Routes

**Auth** `/form`
- `POST /signup` `{ userName, email, password, age }` → OTP email
- `POST /send-verify-email` `{ email }` · `POST /verify-otp` `{ email, otp }`
- `POST /login` `{ email, password }` → `data: { ...user, token }`
- `POST /auth/google` `{ idToken, age? }` (age only for new accounts)
- `GET /get-email-exist/:email` → `data: { email, google } | null`
- `POST /verify-token` (Bearer) → fresh user + token, used by the splash screen

**Codes** `/action`
- `POST /get-reset-code/:email` → `POST /verify-reset-password/:email { otp }` → `POST /reset-password/:email { password }`
- `POST /get-mail-changed-code/:newEmail` · `POST /verify-user-email/:oldEmail { email, otp }`

**Profile** `/user` (Bearer)
- `GET /me` · `PATCH /profile { userName?, bio?, age?, image? }` (image = base64 data url, bio max 300)
- `PATCH /password { oldPassword, newPassword }` · `PATCH /email { email }`
- Google accounts have no password: `PATCH /password` and `POST /action/get-reset-code/:email` refuse them. The user data has `google: true|false`.

**Movies** `/movies`
- `GET /?search=&genre=` → live + upcoming, plus `serverTime` for the shared clock
- `GET /:id`
- Admin: `GET /admin/all`, `POST /`, `PATCH /:id`, `DELETE /:id` (hides it)
  Body: `title, description, genres, duration, price, rating, startTime, poster (url or base64), video (url)`
- Admin video: `GET /upload-limit` → `{ maxBytes, plan }` from your Cloudinary plan · `POST /upload-video` (multipart `video`) → `{ url, duration }` (exact seconds, the app rounds up to minutes). Files over the plan limit are refused before they reach Cloudinary.

**Cart** `/cart` (Bearer): `GET /` · `POST /:movieId` · `DELETE /:movieId`
Checks the age rating (PG / 13+ / 16+ / 18+), ended movies and tickets you already have.

**Payments** `/payments`
1. `POST /initialize` (Bearer) → `{ authorizationUrl, reference, callbackUrl }`. The app opens the url in a webview.
2. `POST /verify/:reference` (Bearer) → the server asks Paystack, then creates the tickets.
3. `POST /webhook` → set `https://<your-server>/payments/webhook` in the Paystack dashboard. It catches payments where the app closed early. The signature is checked.

The secret key stays in `.env`. Never put it in the app.

**Tickets** `/tickets` (Bearer): `GET /` · `POST /enter { code }` → `{ movie, elapsedSeconds }` when live

**Notifications** `/notifications` (Bearer): `GET /` · `PATCH /read-all`

**Support** `/support`
- `POST / { message }` → emailed to `SUPPORT_EMAIL` (reply-to = the user) + a copy to the user
- Admin: `GET /admin` · `POST /:id/reply { reply }` → emailed to the user

**Disputes** `/disputes` (Bearer)
- `POST /` `{ reason, description, ticketCode?, evidence?: [base64] }`. Reasons: Ticket not working, Video not playing, Paid but no ticket, Charged twice, Refund request, Age rating issue, Other
- `GET /mine` · `GET /:id` · `POST /:id/comments { message }` · `POST /:id/evidence { image }` · `PATCH /:id/escalate`
- Admin: `GET /admin/all?status=` · `PATCH /:id/status { status: "Under Review" | "Resolved" | "Rejected", note }` (note required to close) · `DELETE /:id`
- Status flow: Open → Under Review (first admin reply) → Escalated (customer) → Resolved / Rejected

**Messages** `/messages` (Bearer). Person to person, plus one team chat per customer that any admin can answer
- `:with` is a user id, or `team` (customer → Cine Verse team). For an admin it is always the customer's id (their team chat)
- `POST / { to, content?, image? }` · `GET /chat/:with` (marks it read) · `PATCH /read/:with` · `GET /unread` → `{ count }`
- `GET /inbox` → `[{ key, team, person, last, unread }]`. Customers see the team chat and their private chats, admins see every team chat (never private chats)
- Messaging an admin from a comment lands in your team chat

**Comments** on movies: `GET /movies/:id/comments` (public) · `POST /movies/:id/comments { text }` (Bearer, max 500) · `DELETE /movies/:id/comments/:commentId` (author or admin)

**Video links** are never in public movie data (list, detail, cart, tickets, socket). Only `POST /tickets/enter` (ticket holders) and the admin list return `videoUrl`.

**Admin** `/admin` (admin only): `GET /stats` · `GET /users?search=` · `PATCH /users/:id { banned? | suspendDays? | role? }`

## Socket.IO

Connect with `auth: { token }`. Every event carries the data, so the app writes it
straight into its state (Riverpod) without calling the API again.

| Event | To | Data |
|---|---|---|
| `notification:new` | user | the notification |
| `cart:updated` | user | the full cart |
| `tickets:new` | user | new tickets (movie inside) |
| `account:updated` | user | admin changed the account → log out |
| `movie:updated` / `movie:deleted` | everyone | the movie / `{ movieId }` |
| `movie:live` | everyone | `{ movieId }` |
| `movie:viewers` | `movie:<id>` room | `{ movieId, viewers }` (emit `movie:join` / `movie:leave`) |
| `new:signup`, `user:updated` | admins | the user |
| `payment:success` | admins | `{ amount, userName, tickets, paidAt }` |
| `support:new` / `support:closed` | admins | the message / `{ _id }` |
| `message:new` | both people (team chats: the customer + admins) | the message + `receiver` |
| `comment:new` / `comment:deleted` | `comments:<movieId>` room (emit `comments:join` / `comments:leave`) | the comment / `{ _id, movieId }` |
| `dispute:new` | admins | the dispute |
| `dispute:updated` | the customer + admins | the dispute (chat, status, evidence) |
| `dispute:deleted` | the customer + admins | the deleted dispute |
| `upload:progress` | the uploading admin | `{ stage: "cloud", percent }` |
| `team:new` | admins | the invited admin |
