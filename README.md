# CHESS JEENO

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-6.1.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express Version](https://img.shields.io/badge/Express-4.21.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Mongoose](https://img.shields.io/badge/MongoDB-Mongoose%208.9-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.4-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

CHESS JEENO is a modern full-stack tournament management and team competition platform tailored for chess clubs, tournament organizers, and competitive players. The application orchestrates individual tournaments (Swiss, Round Robin, and Single-Elimination Knockout) as well as multi-board team competitions, captain rosters, lineup locking, and live standings. Gameplay mechanics—including board rendering, legal move enforcement, chess clocks, anti-cheat, and game conclusion—are delegated directly to [Lichess.org](https://lichess.org) through secure OAuth 2.0 PKCE authentication and automated bulk-pairing APIs.

- **Repository**: [https://github.com/INDIRABANUS/CHESS-JEENO](https://github.com/INDIRABANUS/CHESS-JEENO)
- **Production Frontend**: [https://chess-jeeno.vercel.app](https://chess-jeeno.vercel.app)
- **Production API & Health**: [https://chess-jeeno.onrender.com/api/health](https://chess-jeeno.onrender.com/api/health)

---

## Table of Contents

- [1. Overview](#1-overview)
  - [The Problem](#the-problem)
  - [System Boundary & Delegation Architecture](#system-boundary--delegation-architecture)
  - [Target Users & Core Workflows](#target-users--core-workflows)
- [2. Features](#2-features)
  - [Individual Tournaments](#individual-tournaments)
  - [Team Competitions](#team-competitions)
  - [Lichess Integration](#lichess-integration)
  - [Authentication & User Accounts](#authentication--user-accounts)
  - [Realtime Standings, Notifications & Admin](#realtime-standings-notifications--admin)
- [3. Screenshots](#3-screenshots)
- [4. Technology Stack](#4-technology-stack)
- [5. System Architecture](#5-system-architecture)
- [6. Prerequisites](#6-prerequisites)
- [7. Getting Started](#7-getting-started)
  - [Step 1: Clone the Repository](#step-1-clone-the-repository)
  - [Step 2: Install Dependencies](#step-2-install-dependencies)
  - [Step 3: Configure Local Environment Variables](#step-3-configure-local-environment-variables)
  - [Step 4: Start MongoDB](#step-4-start-mongodb)
  - [Step 5: Run the Development Servers](#step-5-run-the-development-servers)
  - [Step 6: Verify Server Health](#step-6-verify-server-health)
  - [Step 7: Platform Administrator Setup (Safe Bootstrap)](#step-7-platform-administrator-setup-safe-bootstrap)
- [8. Environment Variables](#8-environment-variables)
  - [Backend Environment Variables (`server/.env`)](#backend-environment-variables-serverenv)
  - [Frontend Environment Variables (`client/.env`)](#frontend-environment-variables-clientenv)
  - [Security Mandate: Secret Segregation](#security-mandate-secret-segregation)
- [9. Testing and Validation](#9-testing-and-validation)
- [10. Production Deployment Guide](#10-production-deployment-guide)
  - [Step 1: Database Setup (MongoDB Atlas)](#step-1-database-setup-mongodb-atlas)
  - [Step 2: Backend Deployment (Render or Railway)](#step-2-backend-deployment-render-or-railway)
  - [Step 3: Frontend Deployment (Vercel)](#step-3-frontend-deployment-vercel)
  - [Step 4: Lichess OAuth 2.0 PKCE Setup](#step-4-lichess-oauth-20-pkce-setup)
  - [Step 5: Google Cloud OAuth 2.0 OpenID Connect Setup](#step-5-google-cloud-oauth-20-openid-connect-setup)
  - [Step 6: Deployment Order & Verification Checklist](#step-6-deployment-order--verification-checklist)
  - [Step 7: Platform Administrator Setup (Safe Bootstrap)](#step-7-platform-administrator-setup-safe-bootstrap-1)
- [11. Project Structure](#11-project-structure)
- [12. Security and Limitations](#12-security-and-limitations)
- [13. Contributing](#13-contributing)
- [14. License and Acknowledgements](#14-license-and-acknowledgements)

---

## 1. Overview

### The Problem
Managing chess tournaments and club team matches manually is time-consuming and error-prone. Organizers frequently juggle multiple disconnected tools: spreadsheets for pairings, manual tiebreak calculators, chat groups for coordinating matches, and external boards for gameplay. Generating Swiss or Round Robin pairings, tracking board results across multi-board team matches, resolving interrupted games, and maintaining synchronized standings in real time requires significant manual effort.

### System Boundary & Delegation Architecture
CHESS JEENO bridges operational event management with world-class online chess infrastructure by strictly partitioning platform responsibilities:

| Responsibility Area | Handled By | Implementation Details |
| :--- | :--- | :--- |
| **Chess Gameplay** | **Lichess.org** | Interactive chessboard UI, move legality validation, clock timers, anti-cheat detection, game state, and final result determination. |
| **Tournament Operations** | **CHESS JEENO** | User accounts, tournament creation, registration workflows, Swiss / Round Robin / Knockout engines, pairing generation, team rosters, board assignments, aggregated match points, real-time standings, and dispute management. |

### Target Users & Core Workflows
- **Tournament Organizers**: Configure tournaments or team competitions, set time controls and formats, review join requests, trigger automated pairings, generate rounds, and manually resolve disputed or aborted boards.
- **Team Captains**: Register teams, invite roster members, set board lineups, and lock submissions prior to match start.
- **Players**: Register locally or sign in via Google OAuth, link their personal Lichess account via PKCE, receive real-time pairing notifications, open paired games directly on Lichess, and monitor standings and match history on their dashboard.
- **Platform Administrators**: Inspect platform overview metrics, manage user roles, audit tournament states, and override statuses when required.

---

## 2. Features

### Individual Tournaments
- **Multiple Formats**:
  - **Swiss System**: Implemented using the FIDE-compliant Dutch pairing algorithm via `@echecs/swiss`.
  - **Round Robin**: Full circle-method schedule generation with balanced color distribution.
  - **Single-Elimination Knockout**: Dynamic bracket generation with automatic bye allocation for non-power-of-two participant rosters.
- **Registration Controls**: Public open registration or private organizer-approved join requests with invite link sharing.
- **Pre-Round Orchestration**: Ready-check verification and synchronized countdown banner prior to round start.
- **Live Standings & Tiebreaks**: Real-time standings calculation supporting standard chess tiebreak criteria (Buchholz, Sonneborn-Berger, and direct encounter).

### Team Competitions
- **Formats Supported**: Team Round Robin and Team Swiss competitions.
- **Captain & Roster Management**: Captains create teams, invite players by email/username, and manage roster status (`INVITED`, `ACTIVE`, `DECLINED`, `REMOVED`).
- **Board Lineups**: Configurable board counts (e.g., 4 boards per match). Captains assign players to specific boards and lock lineups prior to match kickoff.
- **Automated Match Execution**: Triggers concurrent game creation on Lichess for all boards with alternating board colors (Board 1 White/Black, Board 2 opposite).
- **Match Scoring**:
  - Individual board points: Win (`1`), Draw (`0.5`), Loss (`0`).
  - Team match points: Win (`3`), Draw (`1`), Loss (`0`).
- **Aborted Board Handling & Review Policy**: Aborted or non-scoreable games trigger a `REVIEW_REQUIRED` match status and withhold match points without fabricating scores.
- **Organizer Dispute Resolution**: Competition organizers can manually override aborted boards (`1-0`, `0-1`, `1/2-1/2`) with an audit reason to finalize match scores and advance standings.

### Lichess Integration
- **OAuth 2.0 with PKCE (RFC 7636)**: Public client authorization using S256 code challenge generation without exposing backend client secrets to third parties.
- **Explicit Scopes**: Requests `preference:read`, `challenge:read`, `challenge:write`, `challenge:bulk`, and `board:play`.
- **Bulk-Pairing API**: Creates games programmatically between matched players with specified clock limits (seconds) and increments.
- **Realtime Result Synchronization**: Streams authoritative game events via Lichess ND-JSON game streams with fallback REST polling to record official results.

### Authentication & User Accounts
- **Local Authentication**: Email and password registration with salted `bcryptjs` password hashing and JWT token issuance.
- **Google OAuth 2.0 (OpenID Connect)**: Sign-in with Google utilizing single-use server-side session handoff tickets, preventing exposure of JWTs in browser URLs or redirection queries.
- **Account Linking**: Automatically links verified Google identities to existing local accounts without overwriting credentials or duplicating database users.

### Realtime Standings, Notifications & Admin
- **Socket.IO Realtime Rooms**: Authoritative tournament rooms broadcasting live events (`GAME_STARTED`, `GAME_STATE`, `GAME_FINISHED`, `STANDINGS_UPDATED`, `ROUND_COMPLETED`).
- **In-App Notification Center**: Unread badge count and real-time push alerts for tournament invitations, join approvals, and match readiness.
- **Player Dashboard**: Aggregated overview of active pairings, pending invitations, and historical tournament performance.
- **Platform Administration**: Role-based access control (`USER` vs `ADMIN`), user search, tournament audit and cancellation controls, platform analytics, and a safe server-side admin bootstrap utility.

---

## 3. Screenshots

> **Note**: Application screenshots will be added here as visual UI captures are created.
>
> *(Optional placeholder for future screenshots, e.g. `docs/screenshots/tournament-details.png`, `docs/screenshots/team-lineup.png`)*

---

## 4. Technology Stack

### Frontend
- **Framework**: [React 18.3](https://react.dev/)
- **Bundler & Dev Server**: [Vite 6.1](https://vitejs.dev/)
- **Routing**: [React Router DOM 6.28](https://reactrouter.com/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/) with PostCSS and Autoprefixer
- **Icons**: [Lucide React 0.475](https://lucide.dev/)
- **HTTP Client**: [Axios 1.7](https://axios-http.com/) (configured with Bearer interceptors)
- **Realtime Client**: [Socket.IO Client 4.8](https://socket.io/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (>= 18.0.0, ES Modules)
- **Framework**: [Express 4.21](https://expressjs.com/)
- **Realtime Server**: [Socket.IO 4.8](https://socket.io/)
- **Chess Pairing Engine**: [@echecs/swiss 5.0](https://www.npmjs.com/package/@echecs/swiss) (FIDE Dutch algorithm)
- **Authentication**: [JSON Web Token (jsonwebtoken 9.0)](https://github.com/auth0/node-jsonwebtoken), [bcryptjs 3.0](https://github.com/dcodeIO/bcrypt.js)
- **Security & Middleware**: Centralized CORS origin sanitizer, standard HTTP security headers, 1MB payload limits

### Database
- **Engine**: [MongoDB](https://www.mongodb.com/) (Local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **ODM**: [Mongoose 8.9](https://mongoosejs.com/)

### External Integrations
- **Gameplay & Pairing**: [Lichess.org API](https://lichess.org/api) (Bulk-Pairing, Game Stream, OAuth 2.0 PKCE)
- **Identity Provider**: [Google Identity Services](https://developers.google.com/identity) (OAuth 2.0 OpenID Connect)

### Deployment & Tooling
- **Frontend Hosting**: [Vercel](https://vercel.com/) (Single Page Application with rewrite routing)
- **Backend Hosting**: [Render](https://render.com/) or [Railway](https://railway.app/) (Node.js Web Service)
- **Process Orchestration**: [Concurrently 9.1](https://github.com/open-cli-tools/concurrently), [Nodemon 3.1](https://nodemon.io/)

---

## 5. System Architecture

```mermaid
flowchart TB
    subgraph ClientBrowser [Client Browser - React SPA]
        UI[React 18 / Tailwind CSS UI]
        Axios[Axios HTTP Client]
        SocketClient[Socket.IO Client]
    end

    subgraph BackendService [Backend Web Service - Express / Node.js]
        Express[Express 4 REST API]
        SocketServer[Socket.IO Realtime Server]
        PairingEngine[Pairing Engine: Swiss / Round Robin / Knockout]
        TeamManager[Team Match & Scoring Service]
        AuthService[Auth & OAuth PKCE Service]
    end

    subgraph DataStore [Database]
        Mongo[(MongoDB Atlas / Local MongoDB)]
    end

    subgraph ExternalServices [External Services]
        Google[Google Cloud OAuth 2.0]
        Lichess[Lichess.org Gameplay & APIs]
    end

    UI --> Axios
    UI --> SocketClient

    Axios -->|REST API Requests| Express
    SocketClient <-->|WebSocket Events| SocketServer

    Express --> Mongo
    Express --> PairingEngine
    Express --> TeamManager
    Express --> AuthService

    AuthService <-->|OpenID Connect| Google
    AuthService <-->|OAuth 2.0 PKCE| Lichess
    TeamManager -->|Bulk-Pairing / Stream API| Lichess
    Lichess -.->|Game Results & Streams| BackendService
```

---

## 6. Prerequisites

Before running CHESS JEENO locally, ensure you have the following installed and configured:

1. **Node.js**: `v18.0.0` or higher (`node -v`)
2. **npm**: `v9.0.0` or higher (`npm -v`)
3. **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI.
4. **Lichess Account** *(Optional for basic UI, Required for live gameplay creation)*: A registered Lichess account and an OAuth application created under [Lichess OAuth Applications](https://lichess.org/account/oauth/app).
5. **Google Cloud Credentials** *(Optional for basic UI, Required for Google Sign-In)*: An OAuth 2.0 Web Client configured in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

---

## 7. Getting Started

### Step 1: Clone the Repository

```bash
git clone https://github.com/INDIRABANUS/CHESS-JEENO.git
cd CHESS-JEENO
```

### Step 2: Install Dependencies

Install dependencies for the root orchestrator, backend server, and frontend client in a single command:

```bash
npm run install:all
```

Alternatively, install dependencies manually within each directory:

```bash
# Root orchestrator dependencies
npm install

# Backend dependencies
npm --prefix server install

# Frontend dependencies
npm --prefix client install
```

### Step 3: Configure Local Environment Variables

Create the local `.env` files for both server and client from their example templates:

**Backend configuration:**
```bash
# On Linux / macOS:
cp server/.env.example server/.env

# On Windows PowerShell:
Copy-Item server/.env.example server/.env
```

**Frontend configuration:**
```bash
# On Linux / macOS:
cp client/.env.example client/.env

# On Windows PowerShell:
Copy-Item client/.env.example client/.env
```

*(Refer to [Environment Variables](#8-environment-variables) below for details on each setting).*

### Step 4: Start MongoDB

Ensure your local MongoDB daemon is running:

```bash
# Windows (if installed as a service) or via mongod:
mongod --dbpath <path-to-data-directory>

# macOS (Homebrew):
brew services start mongodb-community

# Linux (systemd):
sudo systemctl start mongod
```

*(If using MongoDB Atlas, simply provide your connection string in `server/.env`).*

### Step 5: Run the Development Servers

**Option A — Run both backend and frontend concurrently (Recommended):**
```bash
npm run dev
```

**Option B — Run backend and frontend in separate terminals:**

*Terminal 1 (Backend API & Socket.IO on port 5000):*
```bash
npm run dev:server
# or: cd server && npm run dev
```

*Terminal 2 (Frontend Vite dev server on port 5173):*
```bash
npm run dev:client
# or: cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 6: Verify Server Health

Test that the backend API and database connection are operational:

```bash
# Using curl:
curl http://localhost:5000/api/health

# Or on Windows PowerShell:
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

**Expected Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Chess Tournament API is running",
  "database": "connected"
}
```

### Step 7: Platform Administrator Setup (Safe Bootstrap)

To bootstrap your initial `ADMIN` user safely without exposing open administrative endpoints:

1. Register an account via the frontend at [http://localhost:5173/register](http://localhost:5173/register) or through `POST /api/auth/register`.
2. Run the secure server-side bootstrap command on your server environment:
   ```bash
   node server/src/utils/bootstrapAdmin.js your_registered_email@example.com
   ```
   Or via npm prefix:
   ```bash
   ADMIN_BOOTSTRAP_EMAIL=your_registered_email@example.com npm --prefix server run bootstrap:admin
   ```
3. The utility validates the user's existence in MongoDB, updates their role to `ADMIN`, and exits cleanly.

---

## 8. Environment Variables

### Backend Environment Variables (`server/.env`)

| Variable | Description | Local Development Default | Production Required |
| :--- | :--- | :--- | :---: |
| `PORT` | Listening port for Express & Socket.IO | `5000` | Optional (Render injects port) |
| `NODE_ENV` | Runtime environment mode | `development` | **Yes** (`production`) |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/chess_tournament` | **Yes** (MongoDB Atlas URI) |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS (comma-separated if multiple) | `http://localhost:5173` | **Yes** (`https://chess-jeeno.vercel.app`) |
| `JWT_SECRET` | Secret key for signing JWT authentication tokens (min 16 chars in prod, 32 recommended) | `replace_with_strong_production_jwt_secret` | **Yes** |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` | Optional |
| `LICHESS_OAUTH_CLIENT_ID` | Lichess OAuth application client ID | `chess-jeeno` | **Yes** (for Lichess integration) |
| `LICHESS_OAUTH_REDIRECT_URI` | Backend OAuth callback endpoint for Lichess | `http://localhost:5000/api/lichess/callback` | **Yes** (for Lichess integration) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `your_id.apps.googleusercontent.com` | Optional (Required for Google Sign-In) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret (strictly backend-only) | `your_google_client_secret` | Optional (Required for Google Sign-In) |
| `GOOGLE_OAUTH_REDIRECT_URI` | Google OAuth backend callback endpoint | `http://localhost:5000/api/auth/google/callback` | Optional (Required for Google Sign-In) |
| `ADMIN_BOOTSTRAP_EMAIL` | Default target email for server-side admin promotion script | `admin@example.com` | Optional |
| `LICHESS_API_TOKEN` | Optional fallback personal token for local non-production testing | `your_optional_fallback_token` | Optional (Dev only) |

### Frontend Environment Variables (`client/.env`)

| Variable | Description | Local Development Default | Production Example |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for REST API endpoints | `http://localhost:5000/api` | `https://chess-jeeno.onrender.com/api` |
| `VITE_SERVER_URL` | *(Optional)* Dedicated Socket.IO server origin | `http://localhost:5000` | `https://chess-jeeno.onrender.com` |

*(If `VITE_SERVER_URL` is omitted, the frontend automatically strips `/api` from `VITE_API_URL` to derive the Socket.IO server origin).*

### Security Mandate: Secret Segregation
> [!CAUTION]
> **Never configure server secrets in the client-side environment.**
>
> Variables prefixed with `VITE_` are bundled directly into static JavaScript assets by Vite and are visible to anyone inspecting the browser bundle. Variables like `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, and `MONGODB_URI` must **strictly reside in `server/.env`** and on the backend deployment platform.

---

## 9. Testing and Validation

CHESS JEENO includes comprehensive automated test suites covering tournament mechanics, team match scoring, authentication security, and deployment verification.

> **Note**: Automated backend tests interact with MongoDB. Ensure MongoDB is accessible via your `MONGODB_URI` before executing test commands.

### Verified Test & Build Commands

| Command | Purpose | Scope |
| :--- | :--- | :--- |
| `npm run build` | Compiles client SPA bundle with Vite | Frontend build verification |
| `npm --prefix server run verify:deploy` | Milestone deployment readiness check (CORS, env, headers, secrets audit) | System verification |
| `npm run test:team-competition:scoring` | Verifies board scoring, match points, draw rules, aborted boards, and tiebreaks | Team scoring engine |
| `npm run test:team-competition` | Verifies team competition creation, team registration, and status flows | Team competition core |
| `npm run test:team-competition:matches` | Tests match schedule generation, board allocation, and lineup locking | Team matches |
| `npm run test:team-competition:execution` | Validates concurrent game execution and result synchronization | Match execution |
| `npm --prefix server run test:lichess:oauth` | Tests PKCE verifier/challenge generation, CSRF state protection, and token storage | Lichess OAuth PKCE |
| `npm --prefix server run test:google:oauth` | Tests Google OpenID Connect flow, exchange tickets, and account linking | Google OAuth 2.0 |
| `npm --prefix server run test:pairings` | Verifies Round Robin pairing algorithm and color balance | Pairing engine |
| `npm --prefix server run test:swiss` | Tests Swiss tournament round generation and FIDE Dutch algorithm | Swiss engine |
| `npm --prefix server run test:knockout` | Tests Single-Elimination Knockout bracket generation and advancement | Knockout engine |
| `npm --prefix server run test:admin` | Verifies admin role-based access control (RBAC) and route protection | Admin authorization |
| `npm --prefix server run test:notifications` | Tests in-app notification creation, unread counts, and push delivery | Notification system |
| `npm --prefix server run test:auth` | Verifies local registration, password hashing, and JWT authorization | Local authentication |

---

## 10. Production Deployment Guide

This guide outlines how to deploy CHESS JEENO to production using **Vercel** (Frontend), **Render / Railway** (Backend + Realtime Socket.IO), and **MongoDB Atlas** (Database).

### Architecture Overview

```text
React / Vite Frontend (Vercel)
         ↓
REST API & Socket.IO (Render / Railway)
         ↓
Database (MongoDB Atlas)  ↔  Gameplay (Lichess OAuth & API)
```

---

### Step 1: Database Setup (MongoDB Atlas)

1. Create a free or dedicated cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a database user with Read and Write privileges.
3. Under **Network Access**, add an IP access rule for `0.0.0.0/0` (Allow Access from Anywhere) to permit connections from dynamic cloud container IPs (Render / Railway).
4. Retrieve your connection string under **Connect > Drivers > Node.js**:
   ```text
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chess_tournament?retryWrites=true&w=majority
   ```

---

### Step 2: Backend Deployment (Render or Railway)

Deploy the `server/` directory as a Node.js Web Service.

- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start` (runs `node src/server.js`)
- **Health Check Path**: `/api/health`

#### Required Environment Variables:

| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Listening port (injected by host) | `10000` (or host assigned) |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/chess_tournament?retryWrites=true&w=majority` |
| `JWT_SECRET` | Strong secret for JWT signing (>= 32 chars) | `your_secure_random_production_secret_32_chars` |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |
| `CLIENT_URL` | Deployed frontend origin (for CORS) | `https://chess-jeeno.vercel.app` |
| `LICHESS_OAUTH_CLIENT_ID` | Lichess OAuth Client ID | `chess-jeeno` |
| `LICHESS_OAUTH_REDIRECT_URI` | Backend OAuth callback endpoint | `https://your-backend.onrender.com/api/lichess/callback` |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Web Client ID | `your_id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 Client Secret | `your_production_google_client_secret` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Backend Google OAuth callback endpoint | `https://chess-jeeno.onrender.com/api/auth/google/callback` |

> **Note on Realtime**: Socket.IO runs on the exact same HTTP server instance and port as Express. The current architecture manages active Lichess streams in-memory within a single backend service instance.

---

### Step 3: Frontend Deployment (Vercel)

Deploy the `client/` directory to Vercel.

- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **SPA Routing**: Handled automatically via `client/vercel.json` rewrites.

#### Required Environment Variables:

| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for backend REST API | `https://your-backend.onrender.com/api` |
| `VITE_SERVER_URL` | *(Optional)* Dedicated Socket.IO URL | `https://your-backend.onrender.com` (auto-derived from `VITE_API_URL` if omitted) |

---

### Step 4: Lichess OAuth 2.0 PKCE Setup

1. Sign in to [Lichess.org](https://lichess.org) and navigate to **[OAuth Applications](https://lichess.org/account/oauth/app)**.
2. Click **Create new app**.
3. Fill in:
   - **Name**: `CHESS JEENO`
   - **Redirect URI**: `https://your-backend.onrender.com/api/lichess/callback`
   - **Client Type**: Public (uses PKCE S256)
4. Verify the required permission scopes configured in CHESS JEENO:
   - `preference:read`
   - `challenge:read`
   - `challenge:write`
   - `challenge:bulk`
   - `board:play`
5. Save and copy the **Client ID** (e.g. `chess-jeeno`) into your backend `LICHESS_OAUTH_CLIENT_ID` environment variable.

---

### Step 5: Google Cloud OAuth 2.0 OpenID Connect Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new Google Cloud project (e.g. `chess-jeeno`) or select an existing project.
3. Configure the **OAuth Consent Screen**:
   - User Type: **External**
   - App Name: `CHESS JEENO`
   - User support email & developer contact email: your email address
   - Scopes: Add non-sensitive identity scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - Publish status: In testing (add test Google users) or publish app for public access
4. Create **OAuth 2.0 Client Credentials**:
   - Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Name: `CHESS JEENO Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (development)
     - `https://chess-jeeno.vercel.app` (production)
   - **Authorized redirect URIs** (must match exactly with scheme, host, and path):
     - `http://localhost:5000/api/auth/google/callback` (development)
     - `https://chess-jeeno.onrender.com/api/auth/google/callback` (production)
5. Save and copy:
   - **Client ID** → configure `GOOGLE_CLIENT_ID` in backend `.env`
   - **Client Secret** → configure `GOOGLE_CLIENT_SECRET` in backend `.env`
6. **Security Mandate**: Never configure `GOOGLE_CLIENT_SECRET` in the frontend (Vercel) environment variables. The client secret must remain strictly backend-only.

---

### Step 6: Deployment Order & Verification Checklist

1. **MongoDB Atlas**: Create cluster, user, and allow network access (`0.0.0.0/0`).
2. **Backend**: Deploy to Render/Railway with MongoDB Atlas URI and placeholder `CLIENT_URL`.
3. **Frontend**: Deploy to Vercel with `VITE_API_URL` pointing to the deployed backend URL + `/api`.
4. **Update CORS**: Set `CLIENT_URL` in the backend service to the exact live Vercel domain.
5. **Update OAuth Providers**:
   - Register production callback URL (`https://your-backend.onrender.com/api/lichess/callback`) in Lichess OAuth App.
   - Register production callback URL (`https://chess-jeeno.onrender.com/api/auth/google/callback`) in Google Cloud Console.
6. **Production Smoke Test**:
   - Access `GET /api/health` on the deployed backend.
   - Register/Sign in using **Continue with Google** or email/password on Vercel frontend.
   - Connect a Lichess account via OAuth on `/profile`.
   - Create a Swiss, Round Robin, or Knockout tournament.
   - Verify realtime game updates and standings.

---

### Step 7: Platform Administrator Setup (Safe Bootstrap)

To bootstrap the first `ADMIN` user safely without exposing public endpoints or modifying source code:

1. Have the prospective administrator register a standard account via the frontend or `POST /api/auth/register`.
2. Run the server-side bootstrap command on the backend environment:
   ```bash
   ADMIN_BOOTSTRAP_EMAIL=admin@yourdomain.com npm --prefix server run bootstrap:admin
   ```
   Or pass the email as an argument:
   ```bash
   node server/src/utils/bootstrapAdmin.js admin@yourdomain.com
   ```
3. The utility verifies the user's existence, promotes their role to `ADMIN`, and exits cleanly. It does not create arbitrary accounts or expose credentials.

---

## 11. Project Structure

```text
CHESS-JEENO/
├── client/                               # Frontend Single Page Application
│   ├── src/
│   │   ├── components/                   # UI components (brackets, tables, modals, cards)
│   │   │   ├── CountdownBanner.jsx       # Synchronized round countdown banner
│   │   │   ├── KnockoutBracket.jsx       # Single-elimination interactive bracket
│   │   │   ├── NotificationBell.jsx      # Header notification bell and unread badge
│   │   │   ├── ParticipantsTable.jsx     # Registered player roster table
│   │   │   ├── RoundCard.jsx             # Round pairings and live board cards
│   │   │   └── StandingsTable.jsx        # Sortable tournament standings table
│   │   ├── context/                      # React context providers (AuthContext)
│   │   ├── layouts/                      # Layout wrappers (MainLayout with responsive nav)
│   │   ├── pages/                        # Application views
│   │   │   ├── AdminAnalyticsPage.jsx    # Platform usage analytics and charts
│   │   │   ├── AdminDashboardPage.jsx    # Platform administrative management
│   │   │   ├── CreateTournamentPage.jsx  # Tournament creation form
│   │   │   ├── CreateTeamCompetitionPage.jsx # Team competition wizard
│   │   │   ├── DashboardPage.jsx         # Player personalized dashboard
│   │   │   ├── HomePage.jsx              # Landing page and platform features
│   │   │   ├── LoginPage.jsx             # Local sign-in & Google OAuth initiation
│   │   │   ├── ProfilePage.jsx           # Profile management & Lichess OAuth connection
│   │   │   ├── TeamCompetitionDetailsPage.jsx # Team competition details, rosters, rounds
│   │   │   ├── TeamMatchDetailsPage.jsx  # Board lineups, match scoring, and overrides
│   │   │   ├── TournamentDetailsPage.jsx # Individual tournament pairings and standings
│   │   │   └── TournamentsPage.jsx       # Filterable tournaments directory
│   │   ├── services/                     # Centralized API service layer
│   │   │   ├── api.js                    # Axios instance with Bearer interceptor
│   │   │   ├── authService.js            # Authentication endpoints & OAuth tickets
│   │   │   ├── lichessService.js         # Lichess connection & status endpoints
│   │   │   ├── socket.js                 # Socket.IO client manager & room listeners
│   │   │   ├── teamCompetitionService.js # Team competition & match scoring API
│   │   │   └── tournamentService.js      # Tournament CRUD, pairings, and rounds API
│   │   ├── App.jsx                       # Application route definitions
│   │   ├── index.css                     # Tailwind CSS base and theme definitions
│   │   └── main.jsx                      # Client application entry point
│   ├── .env.example                      # Client environment variables template
│   ├── index.html                        # HTML template
│   ├── package.json                      # Frontend dependencies & scripts
│   ├── tailwind.config.js                # Tailwind CSS design system configuration
│   ├── vercel.json                       # Vercel SPA routing rewrite configuration
│   └── vite.config.js                    # Vite bundler configuration
│
├── server/                               # Backend REST API & Realtime Service
│   ├── src/
│   │   ├── config/                       # System configuration modules
│   │   │   ├── corsConfig.js             # CORS origin normalization & whitelist
│   │   │   ├── database.js               # MongoDB Mongoose connection manager
│   │   │   ├── envValidator.js           # Production environment validation
│   │   │   ├── googleOAuth.js            # Google OAuth 2.0 OpenID Connect config
│   │   │   └── lichessOAuth.js           # Lichess OAuth 2.0 PKCE config & scopes
│   │   ├── controllers/                  # Express route controllers
│   │   │   ├── adminController.js        # Admin analytics, user role, & audit handlers
│   │   │   ├── authController.js         # Local registration, login, & Google exchange
│   │   │   ├── healthController.js       # Health-check controller (/api/health)
│   │   │   ├── lichessOAuthController.js # Lichess OAuth initiation & callback
│   │   │   ├── teamCompetitionController.js # Team competition, roster, & round handlers
│   │   │   ├── teamMatchController.js    # Lineup lock, board execution, & scoring
│   │   │   └── tournamentController.js   # Tournament lifecycle & pairing handlers
│   │   ├── middleware/                   # Express middleware
│   │   │   ├── authMiddleware.js         # JWT authentication & ADMIN role guards
│   │   │   └── errorHandler.js           # Centralized error & 404 response handlers
│   │   ├── models/                       # Mongoose data schemas & indexes
│   │   │   ├── Notification.js           # User notifications
│   │   │   ├── Pairing.js                # Individual match pairings
│   │   │   ├── Round.js                  # Tournament rounds
│   │   │   ├── TeamCompetition.js        # Team competition entity
│   │   │   ├── TeamCompetitionMember.js  # Team membership & invitations
│   │   │   ├── TeamCompetitionRound.js   # Team competition rounds
│   │   │   ├── TeamCompetitionStanding.js# Team aggregated standings
│   │   │   ├── TeamCompetitionTeam.js    # Team entities & captains
│   │   │   ├── TeamMatch.js              # Inter-team matches & match points
│   │   │   ├── TeamMatchBoard.js         # Individual board pairings & Lichess games
│   │   │   ├── Tournament.js             # Individual tournament entity
│   │   │   └── User.js                   # User accounts & credential isolation
│   │   ├── realtime/                     # Socket.IO realtime infrastructure
│   │   │   ├── gameStreamManager.js      # Lichess ND-JSON live stream consumer
│   │   │   ├── socket.js                 # Socket.IO initialization & handshake auth
│   │   │   └── tournamentRoom.js         # Tournament room management & broadcasting
│   │   ├── routes/                       # Express router definitions (/api/*)
│   │   ├── services/                     # Core business logic services
│   │   │   ├── lichessOAuthService.js    # PKCE challenge & token exchange
│   │   │   ├── lichessService.js         # Bulk-pairing creation & result normalization
│   │   │   ├── pairingService.js         # Pairing orchestration (Swiss / RR / Knockout)
│   │   │   ├── standingsService.js       # Individual standings & tiebreak calculations
│   │   │   ├── teamCompetitionService.js # Team competition lifecycle
│   │   │   └── teamMatchService.js       # Board scoring, match points, & overrides
│   │   ├── utils/                        # Utilities & automated test suites
│   │   │   ├── bootstrapAdmin.js         # Safe server-side admin promotion utility
│   │   │   ├── knockoutPairing.js        # Single-elimination pairing logic
│   │   │   ├── roundRobin.js             # Circle-method Round Robin algorithm
│   │   │   ├── swissPairing.js           # Dutch Swiss pairing wrapper
│   │   │   ├── teamRoundRobin.js         # Team Round Robin scheduling
│   │   │   ├── teamSwiss.js              # Team Swiss scheduling
│   │   │   ├── testGoogleOAuth.js        # Google OAuth automated test suite
│   │   │   ├── testLichessOAuth.js       # Lichess OAuth PKCE automated test suite
│   │   │   ├── testTeamCompetitionScoring.js # Team match scoring test suite
│   │   │   └── verifyDeploymentReadiness.js # Production deployment audit script
│   │   └── server.js                     # Server entry point & listener
│   ├── .env.example                      # Backend environment variables template
│   └── package.json                      # Backend dependencies, engines, & scripts
│
├── .gitignore                            # Git exclusion rules
├── package.json                          # Workspace root orchestration scripts
└── README.md                             # Project documentation
```

---

## 12. Security and Limitations

### Security Architecture
- **Credential Isolation**: User passwords are saved as salted hashes via `bcryptjs` and stripped by default (`select: false`) during Mongoose queries. Lichess OAuth tokens and Google profile credentials are never serialized in public JSON responses.
- **Single-Use OAuth Handoff Tickets**: Google authentication uses short-lived, single-use server tickets redeemed via POST requests, ensuring authentication JWTs never leak into URL bars, browser histories, or HTTP referrers.
- **Strict CORS & Origin Sanitization**: In production, CORS strictly enforces matching origins against `CLIENT_URL` with automatic trailing slash normalization.
- **Safe Admin Bootstrap**: Administrative roles cannot be granted through unauthenticated public endpoints. The provided `bootstrapAdmin.js` utility operates directly against MongoDB on the host machine.

### Operational Boundaries & Limitations
- **Lichess Delegation**: CHESS JEENO intentionally does not implement its own chess engine or chessboard canvas. Clock times, move legality, and anti-cheat enforcement are governed by Lichess.org.
- **Lichess Account Prerequisites**: Both players in an automated pairing must link their Lichess accounts with the `challenge:bulk` and `board:play` scopes. If an unlinked player is paired, the match cannot be automatically spawned on Lichess until their account is linked.
- **Realtime Scalability Boundary**: Socket.IO connections and active Lichess ND-JSON streams are managed in-memory on the active Node.js server instance. In a multi-instance horizontal scaling setup, a Redis adapter (e.g., `@socket.io/redis-adapter`) and centralized stream worker would be required.

---

## 13. Contributing

Contributions to CHESS JEENO are welcome! Follow these steps to submit improvements:

1. **Fork the Repository**: Create your own fork on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit Changes**: Maintain concise, descriptive commit messages.
4. **Validate Before Submitting**:
   - Ensure the client builds cleanly:
     ```bash
     npm run build
     ```
   - Run the deployment and configuration verification:
     ```bash
     npm --prefix server run verify:deploy
     ```
   - Run relevant test suites:
     ```bash
     npm run test:team-competition:scoring
     npm --prefix server run test:lichess:oauth
     ```
5. **Open a Pull Request**: Submit your pull request to the `main` branch with a clear summary of your changes and test results.

---

## 14. License and Acknowledgements

### License
This project is licensed under the **ISC License** as specified in `package.json`.

### Acknowledgements & Third-Party Services
- **[Lichess.org](https://lichess.org)**: For providing an open chess API, real-time board gameplay, and fair-play infrastructure.
  *(Disclaimer: CHESS JEENO is an independent open-source project and is not officially affiliated with or endorsed by Lichess.org).*
- **[@echecs/swiss](https://www.npmjs.com/package/@echecs/swiss)**: For the FIDE Dutch Swiss pairing implementation.
- **[Google Identity Services](https://developers.google.com/)**: For OAuth 2.0 OpenID Connect authentication.
- **Open Source Community**: For the React, Vite, Express, Mongoose, Socket.IO, and Tailwind CSS ecosystems.