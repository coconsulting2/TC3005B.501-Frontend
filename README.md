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

### Running

```sh
bun run dev
```

A browser window should open automatically with the login page (HTTPS via the `@vitejs/plugin-basic-ssl` self-signed cert — accept the warning on first visit).

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

### Configuring

The current version lacks any sort of connection to any sort of backend, as well as any sort of login interface. Therefore, the way to access different dashboards for different roles, is to manually edit the [/src/data/cookies.ts](/src/data/cookies.ts) file to choose the role whose dashboard you want to visualize.

Filename: /src/data/cookies.ts
```typescript
import type { UserRole } from "@type/roles";

const mockCookies = {
    username: "John Doe",
    // CHANGE THIS
    role: "Authorizer" as UserRole //'Applicant' | 'Authorizer' | 'Admin' | 'AccountsPayable' | 'TravelAgency';
};

export const getCookie = (key: keyof typeof mockCookies): string | UserRole => {
    return mockCookies[key];
};
```

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
