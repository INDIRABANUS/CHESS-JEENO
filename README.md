# CHESS JEENO

A modern full-stack web application designed for organizing, managing, and competing in chess tournaments.

---

## 1. Project Overview

The Chess Tournament Management Platform provides an end-to-end tournament operations system while delegating chess gameplay, moves, clocks, and game results to [Lichess](https://lichess.org).

### System Boundary & Delegation Architecture

| Responsibility Area | Handled By | Details |
| :--- | :--- | :--- |
| **Chess Gameplay** | **Lichess** | Board UI, legal move validation, chess clocks, game state, game results |
| **Tournament Operations** | **This Platform** | User accounts, tournament creation, player registration, bracket formats (Swiss, Round Robin, Elimination), pairings calculation, rounds, standings, tournament history, Lichess game ID tracking, auto-generating next rounds |

> **Development Stage**: Full-stack tournament management system supporting Swiss, Round Robin, and Knockout formats with real-time Lichess game synchronization and Socket.IO live updates.

---

## 2. Folder Structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React Context providers (AuthContext)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── layouts/         # Layout components (MainLayout, navigation)
│   │   ├── pages/           # Routed page views (Home, Login, Tournaments, Details, Profile)
│   │   ├── services/        # Centralized Axios API services & Socket.IO client
│   │   ├── utils/           # Frontend helper utilities
│   │   ├── App.jsx          # Route declarations
│   │   ├── index.css        # Tailwind CSS imports & base styles
│   │   └── main.jsx         # Application entry point & router provider
│   ├── .env.example         # Example client environment variables
│   ├── index.html           # HTML template
│   ├── package.json         # Frontend dependencies and scripts
│   ├── postcss.config.js    # PostCSS configuration for Tailwind
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   ├── vercel.json          # Vercel SPA client routing configuration
│   └── vite.config.js       # Vite bundler configuration
│
├── server/
│   ├── src/
│   │   ├── config/          # Database, CORS, Lichess OAuth configuration
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Centralized error, auth, and 404 handlers
│   │   ├── models/          # Mongoose data models
│   │   ├── realtime/        # Socket.IO tournament rooms & stream management
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Server utilities and automated test suites
│   │   └── server.js        # Express application entry point & listener
│   ├── .env.example         # Example server environment variables
│   └── package.json         # Backend dependencies and scripts
│
├── .gitignore
├── package.json             # Root orchestration scripts
└── README.md
```

---

## 3. Installation

Ensure Node.js (v18+) and npm are installed.

To install dependencies across the entire workspace in one command from the project root:

```bash
npm run install:all
```

Alternatively, install dependencies individually:

```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

---

## 4. Environment Variables

### Backend (`server/.env`)

Copy the template from `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Key Variables:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for Express server | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/chess_tournament` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `JWT_SECRET` | Secret for signing JWT authentication tokens | `replace_with_strong_secret` |
| `LICHESS_OAUTH_CLIENT_ID` | Lichess OAuth application client ID | `chess-jeeno` |
| `LICHESS_OAUTH_REDIRECT_URI`| Backend OAuth callback URL | `http://localhost:5000/api/lichess/callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `your_id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret (backend only) | `your_google_client_secret` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Google OAuth backend callback URL | `http://localhost:5000/api/auth/google/callback` |

### Frontend (`client/.env`)

Copy the template from `client/.env.example`:

```bash
cp client/.env.example client/.env
```

Variables:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL for backend API requests | `http://localhost:5000/api` |
| `VITE_SERVER_URL` | *(Optional)* Dedicated Socket.IO URL | `http://localhost:5000` |

---

## 5. Running Locally

### Running the Backend

From the root directory:

```bash
npm run dev:server
```

Or from `server/`:

```bash
cd server
npm run dev
```

### Running the Frontend

From the root directory:

```bash
npm run dev:client
```

Or from `client/`:

```bash
cd client
npm run dev
```

### Running Both Concurrently

```bash
npm run dev
```

---

## 6. Health-Check Endpoint

The backend provides a standardized health check endpoint to verify server and database status.

### Endpoint

```http
GET /api/health
```

### Response (`200 OK`)

```json
{
  "success": true,
  "message": "Chess Tournament API is running",
  "database": "connected"
}
```

---

## 7. Production Deployment Guide

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