<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Issues][issues-shield]][issues-url]

</div>

# TC3005B.501-Frontend
Web Application of the travel management system portal developed during course TC3005B by group 501.

## Getting Started

In order to run this Frontend, the following steps are required:

### Installing

The only option currently is to clone the repository locally from GitHub.

#### Using `git`

```sh
git clone https://github.com/101-Coconsulting/TC3005B.501-Frontend
```

#### Using `gh` (GitHub CLI)

```sh
gh repo clone 101-Coconsulting/TC3005B.501-Frontend
```

### Dependencies

This project uses [Bun](https://bun.com/) as its package manager and script runner. Install dependencies from the root of the repository:

```sh
bun install
```

### Environment variables

Copy the example file and fill in the values for your setup:

```sh
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_API_BASE_URL` | ✅ | Base URL of the Backend API (e.g. `https://localhost:3000/api`). Inlined into the build by Astro, so it must be set **before** building. |
| `PUBLIC_IS_DEV` | ✅ | `true` for local development (relaxes TLS for the self-signed backend cert). |
| `CYPRESS_*_USER` / `CYPRESS_*_PASSWORD` | E2E only | Seeded credentials per role (Solicitante, N1, N2, AV, CPP, Admin) used by the Cypress E2E suite. Only needed to run E2E tests. |
| `CYPRESS_API_BASE` | Optional | Overrides the API URL used by E2E specs. Defaults to `https://localhost:3000/api`. |

### Running

```sh
bun run dev
```

A browser window should open automatically with the login page (HTTPS via the `@vitejs/plugin-basic-ssl` self-signed cert — accept the warning on first visit). Log in at `/login` with a user seeded by the Backend (see the Backend repo's seeding step). The session (token, role and permissions) is stored in cookies and resolved server-side on every SSR request.

---

## Running with Docker

The repository ships a multi-target Dockerfile (`deps` for dev, `production` for GHCR) plus a `docker-compose.dev.yml` that runs `astro dev` inside a container with the host source bind-mounted.

### Local development with hot-reload

```sh
bun run docker:dev          # foreground, streams logs
bun run docker:dev:build    # rebuild image first
bun run docker:dev:down     # stop containers
bun run docker:dev:clean    # stop AND wipe volumes (full reset)
```

This brings up the Astro dev server on `https://localhost:4321`. Edits on the host hot-reload via Vite. The backend must be running on `https://localhost:3000` separately (run `bun run docker:dev` in the backend repo in another terminal).

### Pull from GHCR

```sh
docker run --rm -p 4321:4321 ghcr.io/coconsulting2/tc3005b-501-frontend:latest
```

The backend must be reachable at `https://localhost:3000/api` from the user's browser — the URL is **baked into the image at build time** because Astro inlines `PUBLIC_*` env vars during the Vite build.

### Image tags

| Tag | Description |
|-----|-------------|
| `ghcr.io/coconsulting2/tc3005b-501-frontend:latest` | Latest commit on `main` |
| `ghcr.io/coconsulting2/tc3005b-501-frontend:sha-<short>` | Pinned to a specific commit |

### Building locally with a custom API URL

```sh
docker build -t cocoschemefrontend:custom \
  --build-arg PUBLIC_API_BASE_URL=https://api.example.com/api \
  .
docker run --rm -p 4321:4321 cocoschemefrontend:custom
```

For production builds with a different `PUBLIC_API_BASE_URL`, trigger the `Docker Publish` workflow manually from the Actions tab and supply the `api_base_url` input.

### Testing

The project ships two test layers:

| Layer | Tool | Command |
|-------|------|---------|
| Unit / component | [Vitest](https://vitest.dev/) + Testing Library (jsdom) | `bun run test` |
| Unit + coverage | Vitest (v8 coverage) | `bun run test:coverage` |
| End-to-end | [Cypress](https://www.cypress.io/) | `bunx cypress run` (headless) / `bunx cypress open` (UI) |
| Type checking | `astro check` | `bun run typecheck` |

> [!NOTE]
> The Cypress E2E suite drives the real UI, so it needs **both** the Backend (`https://localhost:3000`) and the Frontend dev server (`https://localhost:4321`) running, plus the `CYPRESS_*` credentials from `.env`.

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start the Astro dev server (HTTPS, hot-reload). |
| `bun run build` | Production build (`astro build`). |
| `bun run preview` | Serve the production build locally. |
| `bun run start` | Run the built SSR server (`dist/server/entry.mjs`). |
| `bun run typecheck` | Type-check the project with `astro check`. |
| `bun run test` | Run the Vitest unit/component suite once. |
| `bun run test:watch` | Run Vitest in watch mode. |
| `bun run test:coverage` | Run Vitest with a coverage report. |
| `bun run docker:dev*` | Docker dev workflows (see the Docker section above). |

### Development Stack

- [![Astro][astro-badge]][astro-url] — The web framework for content-driven websites.
- [![TypeScript][typescript-badge]][typescript-url] — Strongly typed JavaScript for scalable applications.
- [![Tailwind CSS][tailwind-badge]][tailwind-url] — A utility-first CSS framework for building custom designs efficiently.
- [![React][react-badge]][react-url] — A JavaScript library for building user interfaces.

[astro-url]: https://astro.build/
[typescript-url]: https://www.typescriptlang.org/
[tailwind-url]: https://tailwindcss.com/
[react-url]: https://reactjs.org/
[astro-badge]: https://img.shields.io/badge/Astro-fff?style=for-the-badge&logo=astro&logoColor=bd303a&color=352563
[typescript-badge]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white&color=blue
[tailwind-badge]: https://img.shields.io/badge/Tailwind-ffffff?style=for-the-badge&logo=tailwindcss&logoColor=38bdf8
[react-badge]: https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black&color=blue
[contributors-shield]: https://img.shields.io/github/contributors/101-Coconsulting/TC3005B.501-Frontend.svg?style=for-the-badge
[contributors-url]: https://github.com/101-Coconsulting/TC3005B.501-Frontend/graphs/contributors
[issues-shield]: https://img.shields.io/github/issues/101-Coconsulting/TC3005B.501-Frontend.svg?style=for-the-badge
[issues-url]: https://github.com/101-Coconsulting/TC3005B.501-Frontend/issues
