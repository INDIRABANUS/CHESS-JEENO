import http from 'http';
import fs from 'fs';
import path from 'path';

// Helper to fetch an HTTP URL
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runVerification() {
  console.log('=== CHESS JEENO PRODUCT MILESTONE VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. HTTP Server Checks
  console.log('--- 1. HTTP Server & Route Endpoints ---');
  try {
    const apiHealth = await fetchUrl('http://localhost:5000/api/health');
    assert(apiHealth.statusCode === 200, 'Backend API health returns 200 OK');
    const healthJson = JSON.parse(apiHealth.data);
    assert(healthJson.success === true, 'Backend health returns success: true');
  } catch (err) {
    assert(false, `Backend API unreachable: ${err.message}`);
  }

  const routes = ['/', '/about', '/contact', '/help', '/faq'];
  for (const r of routes) {
    try {
      const res = await fetchUrl(`http://localhost:5173${r}`);
      assert(res.statusCode === 200, `Client route ${r} returns 200 OK`);
      assert(res.data.includes('<div id="root">'), `Client route ${r} serves SPA HTML`);
    } catch (err) {
      assert(false, `Client route ${r} failed: ${err.message}`);
    }
  }

  // 2. Component Files Inspection
  console.log('\n--- 2. File Verification & Code Quality ---');
  const baseDir = path.resolve('client', 'src');

  const filesToCheck = [
    { file: 'components/Footer.jsx', requiredTexts: ['CHESS JEENO', 'Tournaments', 'About', 'Contact', 'FAQ', 'Help & How It Works', '2026', 'https://github.com/INDIRABANUS/CHESS-JEENO'] },
    { file: 'pages/AboutPage.jsx', requiredTexts: ['About | CHESS JEENO', 'Round Robin', 'Swiss System', 'Knockout', 'Lichess', 'Standings', 'https://github.com/INDIRABANUS/CHESS-JEENO'] },
    { file: 'pages/ContactPage.jsx', requiredTexts: ['Contact | CHESS JEENO', 'https://github.com/INDIRABANUS/CHESS-JEENO/issues', 'Bug Reports', 'Feature Suggestions'] },
    { file: 'pages/HelpPage.jsx', requiredTexts: ['Help | CHESS JEENO', 'Getting Started', 'Round Robin', 'Swiss', 'Knockout', 'Playing a Game on Lichess', 'Tournament Completion'] },
    { file: 'pages/FAQPage.jsx', requiredTexts: ['FAQ | CHESS JEENO', 'aria-expanded', 'aria-controls', 'Round Robin', 'Swiss', 'Knockout', 'Lichess', 'searchQuery', 'activeCategory'] },
    { file: 'layouts/MainLayout.jsx', requiredTexts: ['<Footer />', 'to="/about"', 'to="/help"', 'to="/faq"', 'to="/contact"'] },
    { file: 'App.jsx', requiredTexts: ['<Route path="about"', '<Route path="contact"', '<Route path="help"', '<Route path="faq"'] },
  ];

  for (const item of filesToCheck) {
    const fullPath = path.join(baseDir, item.file);
    const exists = fs.existsSync(fullPath);
    assert(exists, `File exists: ${item.file}`);
    if (exists) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const text of item.requiredTexts) {
        assert(content.includes(text), `${item.file} contains "${text}"`);
      }
    }
  }

  // 3. Accessibility & Structure checks
  console.log('\n--- 3. Accessibility & Standards Verification ---');
  const faqContent = fs.readFileSync(path.join(baseDir, 'pages/FAQPage.jsx'), 'utf8');
  assert(faqContent.includes('<button'), 'FAQ items use accessible <button> elements');
  assert(faqContent.includes('aria-expanded={isOpen}'), 'FAQ items bind aria-expanded attribute');
  assert(faqContent.includes('aria-controls={contentId}'), 'FAQ items bind aria-controls attribute');
  assert(faqContent.includes('role="region"'), 'FAQ answers use role="region"');
  assert(faqContent.includes('aria-labelledby={faq.id}'), 'FAQ answers use aria-labelledby');

  const contactContent = fs.readFileSync(path.join(baseDir, 'pages/ContactPage.jsx'), 'utf8');
  assert(!contactContent.includes('<form'), 'ContactPage does NOT contain a fake form submission');
  assert(contactContent.includes('https://github.com/INDIRABANUS/CHESS-JEENO/issues'), 'ContactPage links directly to real GitHub Issues');

  const footerContent = fs.readFileSync(path.join(baseDir, 'components/Footer.jsx'), 'utf8');
  assert(footerContent.includes('target="_blank"'), 'External links use target="_blank"');
  assert(footerContent.includes('rel="noopener noreferrer"'), 'External links use rel="noopener noreferrer"');

  // 4. Content Fidelity Check (No hallucinated features)
  console.log('\n--- 4. Content Integrity & Factual Fidelity ---');
  const aboutContent = fs.readFileSync(path.join(baseDir, 'pages/AboutPage.jsx'), 'utf8');
  assert(!aboutContent.includes('cash prizes'), 'No false claim of cash prizes in About');
  assert(!aboutContent.includes('FIDE arbiter certified'), 'No false claim of official FIDE certification');
  assert(aboutContent.includes('Round Robin') && aboutContent.includes('Swiss') && aboutContent.includes('Knockout'), 'Accurately documents the 3 implemented formats');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
