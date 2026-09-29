# ChatKit

ChatKit is a full-stack AI chat application built to explore how a simple request/response chat can grow into a persistent, streaming application. It currently uses Google Gemini for generation, PostgreSQL for chat history, Prisma for database access, and a Next.js App Router API for server-side orchestration.

The most useful starting point is this guide: it describes the implementation that exists today, the decisions behind it, and how to run it locally or with Docker Compose.

## What It Does

- Sends a conversation to a server-side AI provider and streams the assistant reply back as it is generated.
- Saves conversations and messages in PostgreSQL so they can be loaded again later.
- Uses an `AIProvider` contract and factory so another provider can be added without coupling the UI to a vendor. Gemini is the only provider implemented currently.
- Limits requests with either a process-local in-memory Map or Redis.
- Supports stopping a generation and forwards request cancellation through the server to the Gemini SDK.
- Runs the application and PostgreSQL in Docker Compose. Redis is supported by the application but is not currently a Compose service.

## Stack

Next.js 16 App Router, React 19, TypeScript, Prisma, PostgreSQL, Google Gemini (`@google/genai`), optional Redis, and Docker.

## How The Implementation Evolved

The implementation is easier to understand as a sequence of small steps. The earlier full-response path is still present in the provider, while the API uses streaming today.

### 1. Start with a complete response

`AIProvider.generateReply()` returns a `Promise<string>`. The server waits until the model finishes, then can return one JSON response. This is a useful first version because the control flow is straightforward: request in, model call, complete answer out. Its tradeoff is that the user sees nothing while the model is working.

The Gemini implementation still contains this path, but `POST /api/chat` currently calls `generateReplyStream()` instead.

### 2. Put the model behind a provider contract

The `AIProvider` interface describes the operations the rest of the app needs: generate a complete reply or generate a stream. `getAIProvider()` selects an implementation using `AI_PROVIDER`. The route and UI depend on that contract rather than on the Gemini SDK directly.

This is an extension point, not a claim that several providers are already available. To add another vendor, implement the contract and register it in the factory; the provider must also translate app messages and handle that vendor's errors and cancellation semantics.

### 3. Stream output incrementally

Gemini's streaming API yields chunks. `GeminiProvider` encodes those chunks into a `ReadableStream`; the route relays the stream as `text/plain`; `useChat()` reads it with a stream reader and updates one assistant message as text arrives. This avoids waiting for the full answer before the first visible output.

The route also collects the streamed text so it can save the assistant message after generation ends. The response includes the created or selected chat ID in `X-Chat-Id`.

### 4. Persist the conversation

The chat service owns database operations. A new request creates a chat when no `chatId` is supplied, saves the latest user message, and saves the generated assistant text when the stream finishes. The sidebar loads chat summaries from `GET /api/chat`; `GET /api/chat/[chatId]` returns one conversation and its messages.

PostgreSQL is the durable store; the browser's React state is only the current view of that data. Prisma models are in `prisma/schema.prisma`, migrations are in `prisma/migrations`, and database calls are centralized in `src/server/services/chat.service.ts`.

### 5. Add request limiting: Map first, Redis for shared state

`RATE_LIMIT_STORAGE` selects the limiter implementation. Both are configured for five requests per client identifier in a five-minute window.

| Storage | How it works | Best fit | Important limitation |
| --- | --- | --- | --- |
| `local` | A JavaScript `Map` stores each identifier's count and reset time in the running process. | Local development and a single process. | State disappears on restart and is not shared between app instances. |
| `redis` | Redis `INCR` counts requests under a key; the first request sets the key's expiry, and `TTL` supplies the reset time. | Multiple app instances that share one Redis server. | Requires a reachable Redis server and a `REDIS_URL`. |

The current Compose file starts the app and PostgreSQL only. If Redis mode is selected in Compose, set `APP_REDIS_URL` to a Redis endpoint reachable from the app container. For local development, `REDIS_URL` must be reachable from the host process. Do not use `localhost` for a Redis service running in a different container; use its Compose service name or network address.

### 6. Handle errors and cancellation

- The API rejects an empty message list or more than 50 messages with `400`, and a rate-limited request with `429`.
- The hook reads JSON error bodies for non-2xx responses and shows the API's message. Unexpected API failures are logged on the server and returned with a generic message so provider internals are not sent to the browser.
- If a stream fails after it starts, the assistant message is marked with error status and the UI displays an error. The user message has already been persisted; an incomplete assistant reply may not be.
- Stop and unmount actions abort the browser request. The API forwards its `Request.signal` to Gemini, which can stop upstream generation. An aborted partial reply may be saved if some text was already relayed before the stream closed.

This separation matters: an intentional abort is not presented as an application error, while real failures remain visible and diagnosable.

### 7. Run with Docker Compose

Compose starts PostgreSQL with a persistent named volume and the application image. It waits for PostgreSQL's health check, runs `prisma migrate deploy`, and then starts the Next.js standalone server. The app connects to Postgres through the Compose DNS name `postgres`, not `localhost`.

## Run Locally

Prerequisites: Node.js 22 or later, npm, Docker with Compose, and a Gemini API key.

After cloning the repository, run these commands from the project root. In this workflow, the Next.js app runs directly on your machine with `npm run dev`; Docker Compose is used only to provide PostgreSQL, not to run the app container.

1. Create `.env` from the included `.env.example` template, set `GEMINI_API_KEY`, and use the host database URL (`localhost`, not `postgres`):

	```bash
	cp .env.example .env
	```
   In `.env`, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatkit`.
2. Start only PostgreSQL from the Compose file:

	```bash
	docker compose up -d postgres
	```

3. Set `DATABASE_URL` in `.env` to the host-mapped PostgreSQL address. With the example port, use `postgresql://postgres:postgres@localhost:5432/chatkit`.
4. Install dependencies and apply the migration:

	```bash
	npm install
	npx prisma migrate dev
	```

5. Start the development server:

	```bash
	npm run dev
	```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/chat`.

For a host PostgreSQL installation, create the `chatkit` database and set `DATABASE_URL` to its host, port, username, and password instead. `DATABASE_URL` is required by both Prisma and the running application.

## Run With Docker Compose

The current Compose setup uses the published `surajagrawal/chatkit:1.0.6` image and a PostgreSQL 16 container. Start by copying `.env.example` to `.env` and setting `GEMINI_API_KEY`; Docker Compose reads `.env` automatically and uses its values for the app and database. Then run:

```bash
docker compose up -d
docker compose logs -f app
```

Open [http://localhost:3000](http://localhost:3000). Compose passes `APP_DATABASE_URL` to the container as `DATABASE_URL`; the hostname `postgres` resolves on the Compose network. The named `postgres_data` volume keeps database contents when containers are stopped or recreated. `docker compose down` preserves it; deleting the volume deletes the stored chats.

The app container is built to listen on port `3000`; `APP_PORT` controls the host port. `POSTGRES_PORT` controls the host-side PostgreSQL port, not the port used between containers.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes for Gemini | Server-side credential for the Gemini API. Keep it private; never prefix it with `NEXT_PUBLIC_`. |
| `AI_PROVIDER` | No | Provider factory selection; defaults to `gemini`. Gemini is the only implemented provider. |
| `GEMINI_MODEL` | No | Gemini model name; defaults to `gemini-2.5-flash`. |
| `DATABASE_URL` | Yes | PostgreSQL connection used by Prisma and the application process. Use a host-reachable address for local development. |
| `APP_DATABASE_URL` | Compose | Database URL passed into the app container. Its default uses `postgres:5432` on the Compose network. |
| `RATE_LIMIT_STORAGE` | No | `local` (default) or `redis`. |
| `REDIS_URL` | Redis mode | Redis connection URL read by the app process. |
| `APP_REDIS_URL` | Compose + Redis mode | Compose-side value passed to the app as `REDIS_URL`. Point it at a reachable Redis server. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | No | PostgreSQL container initialization settings; defaults are for local development only. |
| `POSTGRES_PORT` | No | Host port mapped to PostgreSQL's container port `5432`; defaults to `5432`. |
| `APP_PORT` | No | Host port mapped to the app's container port `3000`; defaults to `3000`. |

The example credentials are for local development. Change them for any shared or deployed environment, and do not commit `.env` or paste credentials into documentation.

## Request Lifecycle

```text
Chat UI
  -> useChat() adds the user message optimistically
  -> POST /api/chat validates input and applies the rate limit
  -> chat service creates/updates the PostgreSQL conversation
  -> AI provider factory selects Gemini
  -> Gemini stream is relayed as text/plain
  -> useChat() appends each chunk to the assistant bubble
  -> chat service saves the collected assistant reply
```

The UI lives in `src/components/chat/`; client orchestration and streaming are in `src/features/chat/hooks/useChat.ts`; route handlers are in `src/app/api/chat/`; AI contracts and providers are in `src/server/ai/`; persistence is in `src/server/services/chat.service.ts`; limiter strategies are in `src/lib/rate-limit/`.

## Useful Commands

```bash
npm run dev                 # Start the development server
npm run lint                # Run ESLint
npm run build               # Build the production app
npx prisma migrate dev      # Apply migrations during development
npx prisma migrate deploy   # Apply existing migrations in deployment
docker compose up -d         # Start the Compose app and database
docker compose down          # Stop containers; keep the database volume
```

## Next Steps

Good extensions for this project are implementing a second `AIProvider`, adding an optional Redis service to Compose, tightening request validation with the existing validation module, and adding focused tests for error and cancellation paths. These are follow-up opportunities, not features claimed as complete here.
