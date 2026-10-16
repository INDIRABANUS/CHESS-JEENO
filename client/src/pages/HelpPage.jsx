import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  UserCheck,
  Trophy,
  Swords,
  Clock,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Award,
  Zap,
  Users,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  Lock,
  Play,
  RotateCcw,
  Check,
  Search,
} from 'lucide-react';

const HelpPage = () => {
  useEffect(() => {
    document.title = 'Help & How It Works | CHESS JEENO';
  }, []);

  const [activeGuide, setActiveGuide] = useState('participant');
  const [openTroubleshoot, setOpenTroubleshoot] = useState({});

  const toggleTroubleshoot = (id) => {
    setOpenTroubleshoot((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const guideTabs = [
    {
      id: 'participant',
      label: 'Individual Participant',
      icon: UserCheck,
      badge: 'Player Guide',
      summary: 'From joining your first event to moving pieces on Lichess and tracking standings.',
    },
    {
      id: 'organizer',
      label: 'Tournament Organizer',
      icon: Trophy,
      badge: 'Host Guide',
      summary: 'Hosting Swiss, Round Robin, or Knockout events, managing rosters, and starting rounds.',
    },
    {
      id: 'team',
      label: 'Team Captain & Competitor',
      icon: Users,
      badge: 'Team Competition Guide',
      summary: 'Registering squads, managing rosters, assigning board lineups, and playing team matches.',
    },
    {
      id: 'admin',
      label: 'Platform Administrator',
      icon: Shield,
      badge: 'Admin Guide',
      summary: 'Platform oversight, user role administration, tournament moderation, and analytics.',
    },
  ];

  // 1. Participant Guide Content
  const participantPrerequisites = [
    'A registered CHESS JEENO account (email/password or Google OAuth).',
    'A connected Lichess account linked via OAuth 2.0 PKCE on your Profile page.',
    'An open tournament with active registration status.',
  ];

  const participantSteps = [
    {
      num: 1,
      title: 'Sign Up and Connect Lichess',
      desc: 'Create your account or log in with Google. Navigate to your Profile (/profile) and click "Connect Lichess" to grant match authorization via OAuth 2.0 PKCE. Your Lichess username will be verified and linked.',
      badge: 'Prerequisite',
      action: 'Profile → Connect Lichess',
    },
    {
      num: 2,
      title: 'Find an Open Tournament',
      desc: 'Visit the Tournaments directory (/tournaments). Use the format filter (Round Robin, Swiss, Knockout) and status tabs to find a tournament with "Registration Open".',
      badge: 'Discovery',
      action: 'Tournaments Directory',
    },
    {
      num: 3,
      title: 'Submit Join Request',
      desc: 'On the tournament details page, click the green "REQUEST TO JOIN" button. Your status changes to "REQUEST PENDING" while awaiting the tournament host’s review.',
      badge: 'Roster Queue',
      action: 'Click "REQUEST TO JOIN"',
    },
    {
      num: 4,
      title: 'Host Approval & Roster Confirmation',
      desc: 'When the tournament host reviews your request in the pending queue and clicks "APPROVE", you are officially added to the active participant roster.',
      badge: 'Host Review',
      action: 'Awaiting Host Approval',
    },
    {
      num: 5,
      title: 'Mark Yourself Ready ("I\'M READY ✓")',
      desc: 'You can confirm active readiness during either the REGISTRATION or READY_CHECK phase. Click the green "I\'M READY ✓" button. If your availability changes, click "MARK NOT READY" before the countdown begins.',
      badge: 'Check-In',
      action: 'Click "I\'M READY ✓"',
    },
    {
      num: 6,
      title: 'Pre-Round Countdown',
      desc: 'When all participants are ready (minimum 2 players), the host initiates the round countdown. The 60-second countdown banner displays at the top of the tournament page.',
      badge: 'Countdown',
      action: 'Watch 60s Countdown Banner',
    },
    {
      num: 7,
      title: 'Access Your Match Pairing',
      desc: 'When Round 1 begins, your matchup appears in the "My Pairing" card at the top of the page, showing your assigned color (White or Black), your opponent, and clock settings.',
      badge: 'Pairings Ready',
      action: 'Check "My Pairing" Card',
    },
    {
      num: 8,
      title: 'Play on Lichess',
      desc: 'Click "PLAY AS WHITE ♔" or "PLAY AS BLACK ♚" (or "PLAY ON LICHESS") to open your designated Lichess game room in a new tab. If you have not linked your account, the card will display "CONNECT LICHESS TO PLAY".',
      badge: 'Live Gameplay',
      action: 'Click "PLAY ON LICHESS"',
    },
    {
      num: 9,
      title: 'Automatic Result Synchronization',
      desc: 'When your game concludes on Lichess (checkmate, resignation, timeout, or draw agreement), the outcome is streamed directly to CHESS JEENO. If the update lags, click the amber "SYNC RESULT" button on your pairing card.',
      badge: 'Score Recording',
      action: 'Auto-stream or "SYNC RESULT"',
    },
    {
      num: 10,
      title: 'Track Standings and Subsequent Rounds',
      desc: 'Check the live Standings table for your updated score (1 pt win, 0.5 draw, 0 loss) and tiebreak scores (Buchholz or Sonneborn-Berger). When all games in the round conclude, the host generates the next round pairings.',
      badge: 'Progression',
      action: 'View Standings Table',
    },
  ];

  // 2. Organizer Guide Content
  const organizerPrerequisites = [
    'A registered CHESS JEENO account with your personal Lichess account connected.',
    'Basic tournament parameters decided: format, round count, time limit, and increment.',
  ];

  const organizerSteps = [
    {
      num: 1,
      title: 'Create Your Tournament',
      desc: 'Go to /tournaments/create. Choose your format (Swiss, Round Robin, or Knockout), set the time control (minutes per player + increment seconds), total rounds (for Swiss), and maximum participant cap.',
      badge: 'Creation',
      action: 'Click "Create Tournament"',
    },
    {
      num: 2,
      title: 'Invite Players to Register',
      desc: 'Click the "INVITE" button on your tournament details page to copy a direct shareable invite link with pre-populated tournament specifications to share with your club or friends.',
      badge: 'Invitations',
      action: 'Click "INVITE"',
    },
    {
      num: 3,
      title: 'Review and Moderate Join Requests',
      desc: 'As players request entry, their names appear in the on-page "Pending Join Requests" card. Click "APPROVE" to place them on the roster, or "REJECT" to decline their request.',
      badge: 'Roster Control',
      action: 'Click "APPROVE" or "REJECT"',
    },
    {
      num: 4,
      title: 'Initiate the Ready Check',
      desc: 'Once registration is populated with at least 2 players, click "START READY CHECK". This prompts all players to click "I\'M READY ✓" so you can confirm who is actively present.',
      badge: 'Check-In Phase',
      action: 'Click "START READY CHECK"',
    },
    {
      num: 5,
      title: 'Launch the Pre-Round Countdown',
      desc: 'When all players show as ready (ready player count equals total roster count), click "COUNTDOWN (60s)" to give participants 60 seconds of notice, or click "START NOW" to immediately generate Round 1 pairings.',
      badge: 'Round Start',
      action: 'Click "COUNTDOWN (60s)" or "START NOW"',
    },
    {
      num: 6,
      title: 'Automated Pairing & Game Room Creation',
      desc: 'The system computes pairings avoiding repeat matchups (Swiss/Round Robin) or advances bracket winners (Knockout). Official Lichess game rooms are created with the exact clock settings configured.',
      badge: 'Engine Pairing',
      action: 'Pairings Generated',
    },
    {
      num: 7,
      title: 'Synchronize Scores & Rematch Aborted Games',
      desc: 'Scores sync in real time. If a pairing is stalled, click "SYNC RESULT". If a game is aborted before moves are played, an amber "GAME ABORTED" badge displays—click "REMATCH" to launch a fresh game room.',
      badge: 'Match Oversight',
      action: 'Use "SYNC RESULT" or "REMATCH"',
    },
    {
      num: 8,
      title: 'Advance to the Next Round or Conclude',
      desc: 'When all pairings in the current round have final scores, the round concludes. For Swiss/Round Robin, the system proceeds to generate the next round. When all rounds finish, final standings and champions are certified.',
      badge: 'Tournament Finalization',
      action: 'Next Round / Final Standings',
    },
  ];

  // 3. Team Competition Guide Content
  const teamPrerequisites = [
    'A registered CHESS JEENO account for captains and all team roster members.',
    'Connected Lichess accounts for every player who will be assigned to a competitive board.',
    'A minimum of 2 registered teams with appointed Team Captains to begin a competition.',
  ];

  const teamSteps = [
    {
      num: 1,
      title: 'Create or Browse Team Competitions',
      desc: 'Navigate to Team Competitions (/team-competitions). Organizers can click "Create Team Competition" to set up a team event with Swiss or Round Robin format, board count per match (e.g., 4 boards), and team limits.',
      badge: 'Competition Setup',
      action: 'Team Competitions Directory',
    },
    {
      num: 2,
      title: 'Register Your Squad / Team',
      desc: 'While registration is open, click "Register a Squad / Team". Enter your team name, optional tag, and description. As the creator, you are automatically assigned as the Team Captain.',
      badge: 'Team Entry',
      action: 'Click "Register a Squad / Team"',
    },
    {
      num: 3,
      title: 'Invite Members to Your Roster',
      desc: 'Captains click "Manage Roster" on their team card to search for CHESS JEENO users by username and send invitations. Invited players will see a pending invitation banner on the competition page to accept.',
      badge: 'Roster Management',
      action: 'Roster Modal → Invite Members',
    },
    {
      num: 4,
      title: 'Competition Readiness & Schedule Generation',
      desc: 'Once at least 2 teams are registered and ready, the organizer clicks "Mark as READY" and generates the match schedule using "Generate Round Robin" or "Generate Round 1 (Swiss)".',
      badge: 'Schedule Draw',
      action: 'Organizer Schedule Draw',
    },
    {
      num: 5,
      title: 'Captain: Assign Board Lineups',
      desc: 'Open the match details page (/team-competitions/:id/matches/:matchId). Captains use the "TeamLineupManager" workspace to assign active squad players to Board 1 through Board K. Click "Save Lineup" when done.',
      badge: 'Lineup Board Setup',
      action: 'TeamLineupManager → "Save Lineup"',
    },
    {
      num: 6,
      title: 'Confirm Board Readiness & Lock Lineup',
      desc: 'Each assigned board player must confirm readiness. Once all boards are filled and ready, the Captain clicks "Lock Team Lineup". When both team captains have locked their lineups, match status becomes "READY".',
      badge: 'Lock Confirmation',
      action: 'Click "Lock Team Lineup"',
    },
    {
      num: 7,
      title: 'Start Match (Organizer Control)',
      desc: 'With both team squads locked in "READY" status, the competition organizer clicks "Start Match". The platform creates Lichess matches for all boards simultaneously with alternating colors (Board 1: Team A White; Board 2: Team B White, etc.).',
      badge: 'Match Launch',
      action: 'Organizer clicks "Start Match"',
    },
    {
      num: 8,
      title: 'Play Assigned Boards on Lichess',
      desc: 'Players on both squads see their board assignment banner with designated color and opponent. Click "Play on Lichess" to enter your board match on Lichess. Individual board results stream back live.',
      badge: 'Board Play',
      action: 'Click "Play on Lichess"',
    },
    {
      num: 9,
      title: 'Scoring & Resolving Aborted Boards ("REVIEW_REQUIRED")',
      desc: 'Board win = 1 pt, draw = 0.5 pt, loss = 0 pt. If any board game aborts on Lichess, the match enters "REVIEW_REQUIRED" to prevent corrupt scoring. The organizer reviews the board and clicks "Resolve Result" to adjudicate.',
      badge: 'Match Resolution',
      action: 'Click "Resolve Result" if aborted',
    },
    {
      num: 10,
      title: 'Team Standings & Match Points',
      desc: 'When all boards conclude, team match points are calculated: 3 match points for a win, 1 point for a tie, and 0 for a loss. The Team Standings table updates ranking teams by match points, board points, and head-to-head.',
      badge: 'Standings Update',
      action: 'Inspect Team Standings',
    },
  ];

  // 4. Administrator Guide Content
  const adminPrerequisites = [
    'An authenticated user account with user role "ADMIN" assigned.',
    'Initial admin access is established via server environment bootstrap or promotion by an active admin.',
  ];

  const adminSteps = [
    {
      num: 1,
      title: 'Access the Administrative Console',
      desc: 'When signed in with an ADMIN role account, a gold "Admin Console" link appears in the desktop navigation and footer. Navigate directly to /admin.',
      badge: 'Authentication',
      action: 'Open /admin Console',
    },
    {
      num: 2,
      title: 'Platform Overview & Health Monitoring',
      desc: 'The Admin Dashboard provides real-time counts of total registered users, active tournaments, completed tournaments, live pairings, and system status.',
      badge: 'System Pulse',
      action: 'Review Dashboard KPIs',
    },
    {
      num: 3,
      title: 'User Management & Role Assignment',
      desc: 'Navigate to /admin/users. Search and filter users by role or verification status. Click any user to view account details or promote/demote roles between PLAYER and ADMIN. Note: The platform prevents demoting the last remaining admin to prevent lockout.',
      badge: 'User Administration',
      action: 'Manage Users at /admin/users',
    },
    {
      num: 4,
      title: 'Tournament Moderation & Cancellation Safeguards',
      desc: 'Navigate to /admin/tournaments to oversee all public and ongoing events. Admins can inspect tournament configurations or cancel problematic events. Cancellation Safeguard: The system blocks cancellation if live pairings are actively running.',
      badge: 'Tournament Oversight',
      action: 'Moderate at /admin/tournaments',
    },
    {
      num: 5,
      title: 'Platform Analytics & Match Intelligence',
      desc: 'Navigate to /admin/analytics to review 30-day user registration trends, tournament creation activity, game completion ratios, White vs Black win rate distributions, and draw frequencies.',
      badge: 'Business Insights',
      action: 'Explore /admin/analytics',
    },
  ];

  // 5. Troubleshooting Matrix Items
  const troubleshootingItems = [
    {
      id: 'troubleshoot-lichess-link',
      title: 'Lichess Account Not Linked or "CONNECT LICHESS TO PLAY" Displayed',
      problem: 'Pairing card or match board shows "CONNECT LICHESS TO PLAY" instead of the game link, or Lichess games fail to create.',
      cause: 'Your CHESS JEENO profile has not completed OAuth 2.0 PKCE authentication with Lichess, or the token permissions have expired.',
      remedy: 'Go to your Profile page (/profile). Scroll to the "Lichess Integration" card and click "Connect Lichess". Authorize the requested scopes (challenge:bulk, board:play, challenge:write). Once redirected back, return to your tournament page.',
    },
    {
      id: 'troubleshoot-sync-result',
      title: 'Game Finished on Lichess but Result is Not Updating on CHESS JEENO',
      problem: 'You resigned, checkmated, or agreed to a draw on Lichess, but the tournament pairing card still shows status "ACTIVE" or "PENDING".',
      cause: 'The real-time Socket.IO stream or Lichess event webhook experienced a temporary delay or network interruption.',
      remedy: 'Locate your pairing card on the Tournament Details page. Click the amber "SYNC RESULT" button (with the refresh icon). The server will query the Lichess API directly, retrieve the verified game outcome, and update tournament standings.',
    },
    {
      id: 'troubleshoot-ready-check',
      title: 'Cannot Start Countdown or Tournament ("Not All Participants Ready")',
      problem: 'The host buttons "COUNTDOWN (60s)" and "START NOW" are disabled (greyed out).',
      cause: 'The tournament requires at least 2 registered participants, and 100% of participants must have clicked "I\'M READY ✓". If even one player has status "NOT READY", round start is blocked to prevent no-show forfeits.',
      remedy: 'Check the Ready status counter in the tournament header (e.g., "3 / 4 READY"). Prompt unready players to click "I\'M READY ✓". Alternatively, the host can remove inactive participants from the roster before launching the countdown.',
    },
    {
      id: 'troubleshoot-incomplete-round',
      title: 'Previous Round Incomplete / Next Round Pairings Cannot Be Generated',
      problem: 'Organizer cannot generate Round 2 or subsequent Swiss/Round Robin rounds.',
      cause: 'One or more pairings in the current round are still in progress or have an unresolved result.',
      remedy: 'Review all pairing cards in the active round. Check for any pairings showing "ACTIVE" or "ABORTED". Ensure all ongoing games have finalized scores (or use "SYNC RESULT" / "REMATCH"). Once all pairing results are finalized, the next round button will unlock.',
    },
    {
      id: 'troubleshoot-team-lineup',
      title: 'Team Lineup Validation Failures / "Lock Team Lineup" Button Disabled',
      problem: 'Team Captain cannot click the green "Lock Team Lineup" button in the TeamLineupManager.',
      cause: 'All boards must be assigned to unique roster members, all assigned players must have their board readiness toggled on, and any unsaved changes must be saved first.',
      remedy: '1. Check that no duplicate player is assigned to multiple boards. 2. Ensure every board (from Board 1 to Board K) has a player selected. 3. Click "Save Lineup". 4. Ensure each board shows player readiness checked. Once all criteria are met, "Lock Team Lineup" will activate.',
    },
    {
      id: 'troubleshoot-review-required',
      title: 'Team Match Status Stuck in "REVIEW_REQUIRED"',
      problem: 'A team match displays a warning banner and scoring status "REVIEW_REQUIRED". Match points are not awarded.',
      cause: 'One or more board games were aborted on Lichess before standard completion. The system halts automatic match point calculation to prevent unfair forfeits.',
      remedy: 'The Competition Organizer must navigate to the match details page (/team-competitions/:id/matches/:matchId) and click the gold "Resolve Result" button in the action toolbar. The organizer can assign manual board points or adjudicate the outcome, unlocking official match points.',
    },
    {
      id: 'troubleshoot-cancellation',
      title: 'Cannot Cancel Tournament or Delete Match',
      problem: 'Clicking cancel or delete returns an error or warning stating the action cannot be performed.',
      cause: 'CHESS JEENO enforces active game protection: tournaments and team matches with live, running, or rematching games cannot be cancelled while players are actively competing on Lichess.',
      remedy: 'Wait for all active pairings to reach a finished state (or abort the games on Lichess and sync their results). Once no pairings are in "ACTIVE" or "RUNNING" state, the tournament can be safely cancelled by the host or platform administrator.',
    },
  ];

  return (
    <div className="space-y-16 py-4 transition-colors max-w-5xl mx-auto">
      {/* 1. HERO SECTION */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
          <span>OFFICIAL USER GUIDE & DOCUMENTATION</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          How CHESS JEENO Works
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Comprehensive, step-by-step walkthroughs for participants, organizers, team captains, and administrators.
        </p>
      </section>

      {/* 2. ROLE-BASED GUIDE NAVIGATION TABS */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {guideTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeGuide === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveGuide(tab.id)}
                className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ACTIVE GUIDE CONTAINER */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
          {/* Guide Header Banner */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-6 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                {guideTabs.find((t) => t.id === activeGuide)?.badge}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {guideTabs.find((t) => t.id === activeGuide)?.label} Walkthrough
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {guideTabs.find((t) => t.id === activeGuide)?.summary}
            </p>
          </div>

          {/* Prerequisites Callout */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Prerequisites & Requirements</span>
            </h3>
            <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
              {(activeGuide === 'participant'
                ? participantPrerequisites
                : activeGuide === 'organizer'
                ? organizerPrerequisites
                : activeGuide === 'team'
                ? teamPrerequisites
                : adminPrerequisites
              ).map((prereq, idx) => (
                <li key={idx}>{prereq}</li>
              ))}
            </ul>
          </div>

          {/* Step-by-Step Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(activeGuide === 'participant'
              ? participantSteps
              : activeGuide === 'organizer'
              ? organizerSteps
              : activeGuide === 'team'
              ? teamSteps
              : adminSteps
            ).map((step) => (
              <div
                key={step.num}
                className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {step.num}
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {step.badge}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {step.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Key Action:</span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {step.action}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Next Action CTA Banner */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Ready for the next step?
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {activeGuide === 'participant'
                  ? 'Browse current individual tournaments and submit your join request.'
                  : activeGuide === 'organizer'
                  ? 'Set up your tournament parameters and invite competitors.'
                  : activeGuide === 'team'
                  ? 'Explore team competitions, register your squad, or review team standings.'
                  : 'Open the platform admin console to monitor user and tournament operations.'}
              </p>
            </div>
            <Link
              to={
                activeGuide === 'participant'
                  ? '/tournaments'
                  : activeGuide === 'organizer'
                  ? '/tournaments/create'
                  : activeGuide === 'team'
                  ? '/team-competitions'
                  : '/admin'
              }
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition shrink-0 min-h-[44px]"
            >
              <span>
                {activeGuide === 'participant'
                  ? 'Browse Tournaments'
                  : activeGuide === 'organizer'
                  ? 'Host Tournament'
                  : activeGuide === 'team'
                  ? 'View Team Competitions'
                  : 'Open Admin Console'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. TOURNAMENT FORMATS */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Supported Tournament Formats
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Pairings, progression, and tiebreaks vary depending on the format selected at creation:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Round Robin */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              RR
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Round Robin (All-Play-All)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every participant plays against every other player across scheduled rounds using standard circle scheduling. Tiebreaks are resolved via Sonneborn-Berger and head-to-head records.
            </p>
          </div>

          {/* Swiss */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              SW
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Swiss System
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Players are grouped by score each round and matched against opponents with similar records without repeating prior matchups. Tiebreaks prioritize Buchholz scores and head-to-head outcomes.
            </p>
          </div>

          {/* Knockout */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              KO
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Knockout (Single Elimination)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Brackets are seeded with power-of-two pairings (incorporating BYEs when needed). Match winners advance through Quarterfinals, Semifinals, and Finals, while defeated players conclude their run.
            </p>
          </div>
        </div>
      </section>

      {/* 4. LICHESS INTEGRATION & RESULT SYNCHRONIZATION */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            How Gameplay & Lichess Coordination Works
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Understanding the system boundaries between CHESS JEENO and Lichess:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <Swords className="h-4 w-4" />
              <span>CHESS JEENO Operational Layer</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              CHESS JEENO manages player registration, join request approvals, Swiss/Round Robin pairing algorithms, team squads, board lineups, pre-round countdowns, and tournament standings.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <ExternalLink className="h-4 w-4" />
              <span>Lichess Chess Engine</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Live chess games take place on Lichess. Players use Lichess’s digital board, legal move validation, chess clocks with increment, and fair-play detection.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <Zap className="h-4 w-4" />
              <span>Dual Result Synchronization</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Results stream automatically to CHESS JEENO upon conclusion. In addition, every pairing card features a manual "SYNC RESULT" button for immediate on-demand verification.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-semibold text-sm">
              <Shield className="h-4 w-4" />
              <span>OAuth 2.0 PKCE Security</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Account linking requests specific scopes (challenge:bulk, board:play, challenge:write). Access tokens are never exposed to other players or serialized in public API responses.
            </p>
          </div>
        </div>
      </section>

      {/* 5. TROUBLESHOOTING ACCORDION */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-full">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>TROUBLESHOOTING & RECOVERY</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            Common Problems & Solutions
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Actionable fixes for common questions, validation errors, and match synchronization scenarios:
          </p>
        </div>

        <div className="space-y-3">
          {troubleshootingItems.map((item) => {
            const isOpen = Boolean(openTroubleshoot[item.id]);
            const contentId = `${item.id}-content`;
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors shadow-xs"
              >
                <button
                  type="button"
                  id={item.id}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleTroubleshoot(item.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none transition cursor-pointer min-h-[48px]"
                >
                  <span className="pr-4">{item.title}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={contentId}
                    role="region"
                    aria-labelledby={item.id}
                    className="px-5 pb-5 pt-1 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60"
                  >
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                        Symptom / Problem:
                      </strong>{' '}
                      {item.problem}
                    </div>
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                        Underlying Cause:
                      </strong>{' '}
                      {item.cause}
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200">
                      <strong className="font-bold flex items-center space-x-1 text-xs uppercase tracking-wider mb-1">
                        <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Recommended Action:</span>
                      </strong>
                      <p>{item.remedy}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. FOOTER ASSISTANCE CALLOUT */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-3">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">
          Still Have Questions or Feedback?
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Visit our searchable Frequently Asked Questions for quick answers, or submit a bug report via GitHub.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/faq"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition min-h-[40px]"
          >
            <span>Search FAQ</span>
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition min-h-[40px]"
          >
            <span>Contact & Feedback</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HelpPage;
