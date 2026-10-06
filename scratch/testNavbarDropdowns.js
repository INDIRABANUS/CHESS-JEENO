import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('=== CHESS JEENO NAVBAR & DROPDOWN VERIFICATION ===\n');
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

  const mainLayoutPath = path.resolve('client/src/layouts/MainLayout.jsx');
  assert(fs.existsSync(mainLayoutPath), 'MainLayout.jsx exists');
  const content = fs.readFileSync(mainLayoutPath, 'utf8');

  // 1. Dropdown State & Refs
  assert(content.includes('const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);'), 'Admin dropdown state is declared');
  assert(content.includes('const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);'), 'More dropdown state is declared');
  assert(content.includes('const adminDropdownRef = useRef(null);'), 'Admin dropdown ref is declared');
  assert(content.includes('const moreDropdownRef = useRef(null);'), 'More dropdown ref is declared');

  // 2. Active Route Logic
  assert(content.includes("isAdminActive = location.pathname === '/admin' || location.pathname.startsWith('/admin/');"), 'isAdminActive covers /admin and all /admin/* subroutes');
  assert(content.includes("isMoreActive = ['/about', '/help', '/faq', '/contact'].some"), 'isMoreActive covers /about, /help, /faq, /contact');

  // 3. Click-outside & Escape key handlers
  assert(content.includes('handleClickOutside'), 'Click outside handler exists');
  assert(content.includes('mousedown'), 'Listens to mousedown for clicking outside');
  assert(content.includes("e.key === 'Escape'"), 'Escape key closes menus');

  // 4. Admin Dropdown Markup & Accessibility
  assert(content.includes('id="admin-dropdown-trigger"'), 'Admin dropdown trigger has unique ID');
  assert(content.includes('aria-haspopup="true"'), 'Admin dropdown trigger has aria-haspopup="true"');
  assert(content.includes('aria-expanded={isAdminDropdownOpen}'), 'Admin dropdown trigger binds aria-expanded');
  assert(content.includes('aria-controls="admin-dropdown-menu"'), 'Admin dropdown trigger specifies aria-controls');
  assert(content.includes('id="admin-dropdown-menu"'), 'Admin dropdown menu has id="admin-dropdown-menu"');
  assert(content.includes('role="menu"'), 'Admin dropdown menu has role="menu"');

  // 5. Preserved Desktop Admin Route IDs
  assert(content.includes('id="admin-nav-link-desktop"'), 'Preserves admin-nav-link-desktop ID');
  assert(content.includes('id="admin-users-nav-link-desktop"'), 'Preserves admin-users-nav-link-desktop ID');
  assert(content.includes('id="admin-tournaments-nav-link-desktop"'), 'Preserves admin-tournaments-nav-link-desktop ID');
  assert(content.includes('id="admin-analytics-nav-link-desktop"'), 'Preserves admin-analytics-nav-link-desktop ID');

  // 6. More Dropdown Markup & Accessibility
  assert(content.includes('id="more-dropdown-trigger"'), 'More dropdown trigger has unique ID');
  assert(content.includes('aria-expanded={isMoreDropdownOpen}'), 'More dropdown trigger binds aria-expanded');
  assert(content.includes('aria-controls="more-dropdown-menu"'), 'More dropdown trigger specifies aria-controls');
  assert(content.includes('id="more-dropdown-menu"'), 'More dropdown menu has id="more-dropdown-menu"');
  assert(content.includes('to="/about"'), 'More menu contains /about link');
  assert(content.includes('to="/help"'), 'More menu contains /help link');
  assert(content.includes('to="/faq"'), 'More menu contains /faq link');
  assert(content.includes('to="/contact"'), 'More menu contains /contact link');

  // 7. Desktop Layout & Stability
  assert(content.includes('flex-nowrap whitespace-nowrap'), 'Desktop nav enforces single horizontal row with no wrapping');
  assert(content.includes('hidden xl:flex items-center space-x-2 shrink-0'), 'Backend health badge moved to xl to prevent 1024px crowding');
  assert(content.includes('shrink-0'), 'Brand logo and actions have shrink-0 for stable spacing');

  // 8. Mobile Navigation Preservation
  assert(content.includes('id="admin-nav-link-mobile"'), 'Mobile drawer preserves admin-nav-link-mobile');
  assert(content.includes('id="admin-users-nav-link-mobile"'), 'Mobile drawer preserves admin-users-nav-link-mobile');
  assert(content.includes('id="admin-tournaments-nav-link-mobile"'), 'Mobile drawer preserves admin-tournaments-nav-link-mobile');
  assert(content.includes('id="admin-analytics-nav-link-mobile"'), 'Mobile drawer preserves admin-analytics-nav-link-mobile');

  // 9. Active Route Styling Checks
  assert(content.includes('isAdminActive'), 'Admin trigger uses active state styling');
  assert(content.includes('isMoreActive'), 'More trigger uses active state styling');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runTests();
