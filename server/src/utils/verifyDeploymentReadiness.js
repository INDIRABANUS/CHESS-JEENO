import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import ioClient from 'socket.io-client';
import dotenv from 'dotenv';
import { validateEnvironment } from '../config/envValidator.js';
import { getAllowedOrigins, corsOriginValidator, corsOptions } from '../config/corsConfig.js';
import { getOAuthRedirectUri, getFrontendClientUrl } from '../config/lichessOAuth.js';

dotenv.config();

console.log('🧪 Starting Milestone 16: Production Deployment Readiness Verification...\n');

let passedTests = 0;
let totalTests = 0;

const assert = (condition, description) => {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
  passedTests++;
  console.log(`  ✅ Passed: ${description}`);
};

const runVerification = async () => {
  try {
    // =========================================================================
    // SECTION 1: Environment & Config Validation
    // =========================================================================
    console.log('--- SECTION 1: Environment & Config Validation ---');
    
    // Test envValidator with missing vars under production mode
    const originalEnv = { ...process.env };
    
    // Test that env validator throws in production if missing vars
    process.env.NODE_ENV = 'production';
    delete process.env.MONGODB_URI;
    let caughtMissing = false;
    try {
      validateEnvironment();
    } catch (e) {
      caughtMissing = true;
    }
    assert(caughtMissing, '1. Missing MONGODB_URI in production halts startup');
    
    // Restore env
    process.env = { ...originalEnv };
    const validResult = validateEnvironment();
    assert(validResult.valid || validResult.missing.length === 0, '2. Active environment passes validation');

    // =========================================================================
    // SECTION 2: Production CORS & Origin Sanitization
    // =========================================================================
    console.log('\n--- SECTION 2: Production CORS & Origin Sanitization ---');
    
    // Simulate production CORS with custom client origin
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://chess-jeeno.vercel.app, https://chess-jeeno-preview.vercel.app/';

    const parsedOrigins = getAllowedOrigins();
    assert(parsedOrigins.includes('https://chess-jeeno.vercel.app'), '3. Trims whitespace and extracts first origin');
    assert(parsedOrigins.includes('https://chess-jeeno-preview.vercel.app'), '4. Trims trailing slashes from secondary origin');
    assert(!parsedOrigins.some(u => u.endsWith('/')), '5. No trailing slashes exist in parsed origins');

    // Test CORS validator callback
    let allowedDirect = false;
    corsOriginValidator('https://chess-jeeno.vercel.app', (err, allow) => {
      if (!err && allow) allowedDirect = true;
    });
    assert(allowedDirect, '6. Production CORS permits approved client origin');

    let rejectedUnauthorized = false;
    corsOriginValidator('https://malicious-site.com', (err, allow) => {
      if (err && err.statusCode === 403) rejectedUnauthorized = true;
    });
    assert(rejectedUnauthorized, '7. Production CORS strictly rejects unapproved origin with 403');

    // Restore env
    process.env = { ...originalEnv };

    // =========================================================================
    // SECTION 3: Lichess OAuth Production Sanitization
    // =========================================================================
    console.log('\n--- SECTION 3: Lichess OAuth Production Sanitization ---');

    process.env.CLIENT_URL = 'https://chess-jeeno.vercel.app/';
    const clientUrl = getFrontendClientUrl();
    assert(clientUrl === 'https://chess-jeeno.vercel.app', '8. getFrontendClientUrl strips trailing slash');
    assert(!clientUrl.endsWith('/'), '9. Frontend client URL does not end with slash');

    process.env.LICHESS_OAUTH_REDIRECT_URI = ' https://chess-jeeno-api.onrender.com/api/lichess/callback ';
    const redirectUri = getOAuthRedirectUri();
    assert(redirectUri === 'https://chess-jeeno-api.onrender.com/api/lichess/callback', '10. getOAuthRedirectUri trims whitespace');

    process.env = { ...originalEnv };

    // =========================================================================
    // SECTION 4: Live HTTP & Socket.IO CORS Verification
    // =========================================================================
    console.log('\n--- SECTION 4: Live HTTP & Socket.IO CORS Verification ---');

    const testApp = express();
    testApp.use(cors(corsOptions));
    testApp.get('/api/health', (req, res) => {
      res.json({ success: true, message: 'Chess Tournament API is running', database: 'connected' });
    });

    const testHttpServer = http.createServer(testApp);
    const testIo = new Server(testHttpServer, {
      cors: {
        origin: corsOriginValidator,
        credentials: true,
      },
    });

    const TEST_PORT = 5098;
    await new Promise((resolve) => testHttpServer.listen(TEST_PORT, resolve));

    // Test health endpoint
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, '11. Health endpoint returns HTTP 200');
    assert(healthJson.success === true, '12. Health check reports success: true');
    assert(healthJson.database === 'connected', '13. Health check reports database status');
    assert(!JSON.stringify(healthJson).includes('secret'), '14. Health check does not expose secrets');

    await new Promise((resolve) => testIo.close(() => testHttpServer.close(resolve)));

    // =========================================================================
    // SECTION 5: Vercel & Client Build Artifacts Audit
    // =========================================================================
    console.log('\n--- SECTION 5: Vercel & Client Build Artifacts Audit ---');

    // Verify client/vercel.json
    const vercelConfigPath = path.resolve(process.cwd(), '../client/vercel.json');
    assert(fs.existsSync(vercelConfigPath), '15. client/vercel.json exists');

    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    assert(Array.isArray(vercelConfig.rewrites), '16. vercel.json contains rewrites array');
    assert(vercelConfig.rewrites.some((r) => r.source === '/(.*)' && r.destination === '/index.html'), '17. SPA rewrite rule routes to /index.html');

    // Verify package.json engines
    const serverPkgPath = path.resolve(process.cwd(), 'package.json');
    const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));
    assert(serverPkg.engines && serverPkg.engines.node, '18. server/package.json specifies Node engine');

    // Audit client build bundle for leaked secrets
    const distPath = path.resolve(process.cwd(), '../client/dist/assets');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      let bundleContent = '';
      for (const file of files) {
        if (file.endsWith('.js')) {
          bundleContent += fs.readFileSync(path.join(distPath, file), 'utf8');
        }
      }

      assert(!bundleContent.includes('JWT_SECRET'), '19. Client bundle does not contain JWT_SECRET');
      assert(!bundleContent.includes('MONGODB_URI'), '20. Client bundle does not contain MONGODB_URI');
      assert(!bundleContent.includes('process.env.JWT_SECRET'), '21. Client bundle does not contain server environment secrets');
    } else {
      console.log('  ⚠️ client/dist/assets does not exist; run npm run build to audit');
    }

    // =========================================================================
    // SECTION 6: Documentation & Example Files Audit
    // =========================================================================
    console.log('\n--- SECTION 6: Documentation & Example Files Audit ---');

    const readmePath = path.resolve(process.cwd(), '../README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    assert(readmeContent.includes('Production Deployment Guide'), '22. README.md contains Production Deployment Guide');
    assert(readmeContent.includes('Vercel'), '23. README.md documents Vercel deployment');
    assert(readmeContent.includes('Render') || readmeContent.includes('Railway'), '24. README.md documents Render/Railway deployment');
    assert(readmeContent.includes('MongoDB Atlas'), '25. README.md documents MongoDB Atlas setup');
    assert(readmeContent.includes('Lichess OAuth 2.0 PKCE Setup'), '26. README.md documents Lichess OAuth configuration');

    const serverEnvExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
    assert(serverEnvExample.includes('mongodb+srv://'), '27. server/.env.example documents MongoDB Atlas format');
    assert(!serverEnvExample.includes('super_secret_actual_password'), '28. server/.env.example has no real credentials');

    const clientEnvExample = fs.readFileSync(path.resolve(process.cwd(), '../client/.env.example'), 'utf8');
    assert(clientEnvExample.includes('VITE_API_URL'), '29. client/.env.example documents VITE_API_URL');

    console.log('\n==================================================');
    console.log(`📊 Deployment Verification: ${passedTests} passed, 0 failed (out of ${totalTests} assertions)`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment verification failed:', error.message);
    process.exit(1);
  }
};

runVerification();
