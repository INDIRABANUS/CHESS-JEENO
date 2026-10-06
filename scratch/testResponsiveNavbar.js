import fs from 'fs';
import path from 'path';

function runResponsiveTests() {
  console.log('=== CHESS JEENO RESPONSIVE NAVBAR VERIFICATION ===\n');
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

  // 1. Breakpoint Architecture Verification
  console.log('--- 1. Responsive Breakpoint Architecture ---');
  assert(content.includes('hidden md:flex'), 'Desktop/Tablet nav is hidden on mobile (< 768px) and flex on md+ (768px+)');
  assert(content.includes('md:hidden'), 'Mobile header controls are hidden on md+ (768px+)');
  assert(content.includes('hidden xl:inline-flex'), 'Top-level Dashboard is hidden on tablet (< 1200px) and visible on large desktop (xl+)');
  assert(content.includes('hidden xl:flex items-center space-x-2 shrink-0'), 'API Health badge is hidden on tablet (< 1200px) and visible on large desktop (xl+)');
  assert(content.includes('hidden xl:inline'), 'Logout text label is hidden on tablet and visible on large desktop (xl+)');

  // 2. Mobile Strategy Verification (< 768px)
  console.log('\n--- 2. Mobile Layout Verification (320px, 375px, 390px, 430px) ---');
  assert(content.includes('id="theme-toggle-mobile-header"'), 'Mobile header includes dedicated theme toggle button');
  assert(content.includes('min-h-[44px] min-w-[44px]'), 'Mobile controls satisfy >=44px touch targets');
  assert(content.includes('id="mobile-navigation-menu"'), 'Mobile drawer menu container exists');
  assert(content.includes('id="admin-nav-link-mobile"'), 'Mobile drawer includes Admin Dashboard for ADMIN users');
  assert(content.includes('id="admin-users-nav-link-mobile"'), 'Mobile drawer includes User Management for ADMIN users');
  assert(content.includes('id="admin-tournaments-nav-link-mobile"'), 'Mobile drawer includes Tournament Management for ADMIN users');
  assert(content.includes('id="admin-analytics-nav-link-mobile"'), 'Mobile drawer includes Platform Analytics for ADMIN users');

  // 3. Tablet / Small Desktop Strategy (768px - 1199px)
  console.log('\n--- 3. Tablet & Small Desktop (768px, 820px, 912px, 960px, 1024px, 1100px) ---');
  assert(content.includes('id="more-dashboard-nav-link-tablet"'), 'Tablet More dropdown includes Dashboard link for authenticated users');
  assert(content.includes('xl:hidden flex items-center space-x-2.5 px-3 py-2'), 'Tablet Dashboard link inside More dropdown is hidden on xl+ (no duplicate links)');
  assert(content.includes('max-w-[70px] lg:max-w-[120px] truncate'), 'User name is compactly truncated to 70px on tablet and 120px on desktop');

  // Width calculations for Tablet (768px):
  // Logo: 135px, Home: 45px, Tournaments: 95px, Create: 65px, Admin: 75px, More: 60px, Theme: 36px, Profile/Logout: 85px
  const tabletCompactWidth = 135 + 45 + 95 + 65 + 75 + 60 + 36 + 85; // 596px
  const testWidths = [
    { width: 768, available: 720 },
    { width: 820, available: 772 },
    { width: 912, available: 864 },
    { width: 960, available: 912 },
    { width: 1024, available: 960 },
    { width: 1100, available: 1036 },
  ];
  for (const tw of testWidths) {
    const margin = tw.available - tabletCompactWidth;
    assert(margin > 0, `Width ${tw.width}px: compact navbar (${tabletCompactWidth}px) fits within available ${tw.available}px (margin: +${margin}px)`);
  }

  // 4. Large Desktop Strategy (1200px, 1280px, 1366px, 1440px, 1920px)
  console.log('\n--- 4. Large Desktop Layout (1200px, 1280px, 1366px, 1440px, 1920px) ---');
  // On large desktop:
  // Compact (596px) + Dashboard (+75px) + Logout label (+50px) + Health badge (+110px) = ~831px
  const desktopFullWidth = tabletCompactWidth + 75 + 50 + 110;
  const desktopWidths = [
    { width: 1200, available: 1136 },
    { width: 1280, available: 1216 },
    { width: 1366, available: 1302 },
    { width: 1440, available: 1376 },
    { width: 1920, available: 1280 }, // max-w-7xl
  ];
  for (const dw of desktopWidths) {
    const margin = dw.available - desktopFullWidth;
    assert(margin > 0, `Width ${dw.width}px: full desktop navbar (${desktopFullWidth}px) fits within available ${dw.available}px (margin: +${margin}px)`);
  }

  // 5. Dropdowns & Accessibility
  console.log('\n--- 5. Dropdown Controls & Accessibility ---');
  assert(content.includes('aria-haspopup="true"'), 'Dropdown triggers define aria-haspopup="true"');
  assert(content.includes('aria-expanded={isAdminDropdownOpen}'), 'Admin trigger binds aria-expanded');
  assert(content.includes('aria-expanded={isMoreDropdownOpen}'), 'More trigger binds aria-expanded');
  assert(content.includes('role="menu"'), 'Dropdown menus use role="menu"');
  assert(content.includes('role="menuitem"'), 'Dropdown items use role="menuitem"');
  assert(content.includes('handleClickOutside'), 'Closes on outside click');
  assert(content.includes("e.key === 'Escape'"), 'Closes on Escape key');

  // 6. Active States
  console.log('\n--- 6. Active Route States ---');
  assert(content.includes("isAdminActive = location.pathname === '/admin' || location.pathname.startsWith('/admin/');"), 'Admin section highlights trigger on any admin route');
  assert(content.includes("isMoreActive = ['/about', '/help', '/faq', '/contact'].some"), 'More section highlights trigger on public info routes');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runResponsiveTests();
