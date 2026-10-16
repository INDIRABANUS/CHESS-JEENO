import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Search,
  User,
  Trophy,
  Swords,
  BarChart3,
  Shield,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const FAQPage = () => {
  useEffect(() => {
    document.title = 'FAQ | CHESS JEENO';
  }, []);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (id) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const categories = [
    { id: 'all', label: 'All Questions', icon: HelpCircle },
    { id: 'account', label: 'Account & Login', icon: User },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'teams', label: 'Team Competitions', icon: Users },
    { id: 'games', label: 'Games & Pairings', icon: Swords },
    { id: 'standings', label: 'Standings & Results', icon: BarChart3 },
  ];

  const faqData = [
    // Account & Login
    {
      id: 'faq-account-needed',
      category: 'account',
      question: 'Do I need an account to use CHESS JEENO?',
      answer:
        'You can browse public tournaments and view ongoing standings without an account. However, creating tournaments, requesting to join events, registering teams, and competing in games require a registered CHESS JEENO account.',
    },
    {
      id: 'faq-google-login',
      category: 'account',
      question: 'Can I sign in with Google?',
      answer:
        'Yes. In addition to standard email and password authentication, CHESS JEENO supports Google OAuth 2.0 sign-in for fast and secure access.',
    },
    {
      id: 'faq-lichess-auth',
      category: 'account',
      question: 'How does Lichess authentication work?',
      answer:
        'You can link your personal Lichess account from your Profile page using OAuth 2.0 PKCE. This securely connects your Lichess username so CHESS JEENO can verify your account, create game pairings, and track live matches on Lichess.',
    },
    {
      id: 'faq-lichess-permissions',
      category: 'account',
      question: 'Why do I need a Lichess account and what permissions are requested?',
      answer:
        'CHESS JEENO relies on Lichess as its game execution engine for live chessboards, official clocks, and legal move validation. Linking your account via OAuth 2.0 PKCE requests scopes to create matches and synchronize results (challenge:bulk, board:play, challenge:write). CHESS JEENO never accesses or stores your Lichess password.',
    },
    {
      id: 'faq-profile-view',
      category: 'account',
      question: 'Where can I view my profile?',
      answer:
        'When logged in, click your user badge or avatar in the top navigation bar to open your Profile page (/profile). Here you can manage your display name, bio, view account details, and connect or disconnect your Lichess account.',
    },
    {
      id: 'faq-history-view',
      category: 'account',
      question: 'Where can I see my tournament history?',
      answer:
        'Your tournament history is displayed on your Player Dashboard (/dashboard) as well as your Profile page. You can review your past tournament participations, placements, and win-draw-loss records.',
    },

    // Tournaments (Individual)
    {
      id: 'faq-join-tournament',
      category: 'tournaments',
      question: 'How do I join an individual tournament?',
      answer:
        'Browse the Tournaments directory (/tournaments), select a tournament with "Registration Open" status, and click the green "REQUEST TO JOIN" button. Once submitted, your request is placed in the host queue with status "REQUEST PENDING".',
    },
    {
      id: 'faq-pending-request',
      category: 'tournaments',
      question: 'Why is my join request pending?',
      answer:
        'Tournament hosts maintain full roster moderation. Your request remains in "REQUEST PENDING" status until the tournament host reviews your entry in the on-page "Pending Join Requests" card and clicks "APPROVE".',
    },
    {
      id: 'faq-approves-participants',
      category: 'tournaments',
      question: 'Who approves participants and where?',
      answer:
        'The host who created the tournament reviews and manages join requests directly on the tournament details page inside the "Pending Join Requests" card using the "APPROVE" and "REJECT" buttons. Platform administrators also possess oversight.',
    },
    {
      id: 'faq-supported-formats',
      category: 'tournaments',
      question: 'What tournament formats are supported?',
      answer:
        'CHESS JEENO currently supports three individual formats: Round Robin (all-play-all schedule), Swiss System (players are paired against opponents with similar standings each round), and Knockout (single-elimination bracket until a champion is crowned).',
    },
    {
      id: 'faq-ready-check',
      category: 'tournaments',
      question: 'How does the Ready Check ("I\'M READY ✓") work?',
      answer:
        'Participants click "I\'M READY ✓" to confirm active readiness during either the REGISTRATION or READY_CHECK phase. If your availability changes, click "MARK NOT READY". Both "COUNTDOWN (60s)" and "START NOW" require 100% of participants to be ready (minimum 2 players) before Round 1 pairings can be generated.',
    },
    {
      id: 'faq-organizer-start',
      category: 'tournaments',
      question: 'Do tournaments start automatically?',
      answer:
        'No. Tournaments do not start automatically. The host must verify that all participants have marked themselves ready, and then click either "COUNTDOWN (60s)" (giving 60 seconds of notice) or "START NOW" to immediately generate round pairings.',
    },

    // Team Competitions
    {
      id: 'faq-team-competitions-overview',
      category: 'teams',
      question: 'How do Team Competitions work on CHESS JEENO?',
      answer:
        'Team competitions pit clubs or squads against one another across multiple competitive boards (e.g., 4 boards per match). Events can run in Round Robin or Swiss format. Each team appoints a Captain who registers the squad, manages the roster, and assigns players to specific boards for each scheduled match.',
    },
    {
      id: 'faq-team-captain-role',
      category: 'teams',
      question: 'What are the responsibilities of a Team Captain?',
      answer:
        'Team Captains invite and accept roster members, assign squad players to individual boards (Board 1 through Board K) before each match in the TeamLineupManager, confirm player readiness, and lock the squad lineup. When both team captains lock their lineups, the match enters "READY" status for the organizer to start.',
    },
    {
      id: 'faq-team-lineup-colors',
      category: 'teams',
      question: 'How are board lineups and player colors assigned in team matches?',
      answer:
        'The Team Captain assigns players to boards via the TeamLineupManager workspace on the match page. Player colors automatically alternate across boards to ensure fair balance: for Team A, odd boards (1, 3, 5...) play White while even boards (2, 4, 6...) play Black. For Team B, odd boards play Black and even boards play White.',
    },
    {
      id: 'faq-team-review-required',
      category: 'teams',
      question: 'What does the "REVIEW_REQUIRED" match status mean?',
      answer:
        'If a board game is aborted or encounters an unresolved dispute on Lichess, CHESS JEENO places the match in "REVIEW_REQUIRED" status. This prevents automatic calculation of final match points until the Competition Organizer uses the "Resolve Result" tool to adjudicate the board or assign manual points.',
    },
    {
      id: 'faq-team-scoring',
      category: 'teams',
      question: 'How are team match points and standings calculated?',
      answer:
        'Each individual board game awards standard chess points (1 for win, 0.5 for draw, 0 for loss). The team with the higher sum of board points wins the match, earning 3 match points. A tied match awards 1 match point to each team, and a loss awards 0 points. Standings are ranked by match points, followed by total board points and head-to-head tiebreaks.',
    },

    // Games & Pairings
    {
      id: 'faq-where-played',
      category: 'games',
      question: 'Where are chess games played?',
      answer:
        'Chess games are played on Lichess (lichess.org). CHESS JEENO handles the tournament organization, bracket structures, and pairings, while Lichess provides the digital chessboard, clocks, move validation, and game arbitration.',
    },
    {
      id: 'faq-where-pairing',
      category: 'games',
      question: 'Where can I see my pairing?',
      answer:
        'When a round starts, your current matchup is featured prominently at the top of the Tournament Details page in the "My Pairing" card, displaying your assigned color (White or Black), your opponent, and a direct button to launch the game on Lichess.',
    },
    {
      id: 'faq-connect-lichess-to-play',
      category: 'games',
      question: 'Why do I see "CONNECT LICHESS TO PLAY" on my pairing card?',
      answer:
        'If your CHESS JEENO account has not yet been linked with a Lichess account, the system cannot open your game room. Clicking "CONNECT LICHESS TO PLAY" navigates directly to your Profile page where you can complete the one-click Lichess OAuth connection.',
    },
    {
      id: 'faq-sync-result-button',
      category: 'games',
      question: 'What does the "SYNC RESULT" button do?',
      answer:
        'While game outcomes usually synchronize automatically through live Socket.IO streams, network latency can occasionally delay an update. Clicking "SYNC RESULT" on any active pairing or board card immediately queries the Lichess API to fetch and verify the official game result, updating tournament standings on the spot.',
    },
    {
      id: 'faq-aborted-game',
      category: 'games',
      question: 'What happens if a game is aborted on Lichess?',
      answer:
        'If a game on Lichess is aborted before moves are played, CHESS JEENO flags the pairing as "GAME ABORTED". In individual tournaments, an amber "REMATCH" button appears on the pairing card allowing the host or players to launch a fresh game room. In team competitions, an aborted board sets the match status to "REVIEW_REQUIRED" for organizer resolution.',
    },
    {
      id: 'faq-results-sync',
      category: 'games',
      question: 'How are results synchronized?',
      answer:
        'CHESS JEENO synchronizes game outcomes directly from Lichess through real-time streams and API verification. As soon as a game concludes on Lichess (checkmate, resignation, draw, timeout), the result updates automatically in CHESS JEENO without manual entry.',
    },

    // Standings
    {
      id: 'faq-standings-reflected',
      category: 'standings',
      question: 'How are tournament results reflected in individual standings?',
      answer:
        'Match outcomes are calculated using standard chess scoring: a win awards 1 point, a draw awards 0.5 points, and a loss awards 0 points. Standings tables update dynamically as games finish, ranking players by total points, Buchholz/Sonneborn-Berger tiebreaks, and head-to-head records.',
    },
    {
      id: 'faq-completed-tournaments',
      category: 'standings',
      question: 'Where can I view completed tournament results?',
      answer:
        'Completed tournaments are archived and viewable on the Tournaments page under the "Completed" filter. Clicking on a completed tournament shows the tournament winner, final standings table, and all round pairing archives.',
    },
  ];

  // Filter items based on active category and search text
  const filteredFaqs = faqData.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-12 py-4 transition-colors max-w-4xl mx-auto">
      {/* 1. HERO SECTION */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
          <span>FREQUENTLY ASKED QUESTIONS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
          Find fast answers about accounts, tournament hosting, team competitions, board lineups, and Lichess synchronization.
        </p>

        {/* Search Bar */}
        <div className="pt-2 max-w-lg mx-auto">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              id="faq-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions or keywords..."
              aria-label="Search questions"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
        </div>
      </section>

      {/* 2. CATEGORY PILLS */}
      <section className="flex flex-wrap items-center justify-center gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[40px] ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </section>

      {/* 3. ACCORDION FAQ ITEMS */}
      <section className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <HelpCircle className="h-8 w-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              No matching questions found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Try adjusting your search terms or selecting a different category.
            </p>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = !!openItems[faq.id];
            const contentId = `${faq.id}-content`;
            return (
              <div
                key={faq.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors shadow-xs"
              >
                <button
                  type="button"
                  id={faq.id}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleItem(faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none transition cursor-pointer min-h-[48px]"
                >
                  <span className="pr-4">{faq.question}</span>
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
                    aria-labelledby={faq.id}
                    className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60"
                  >
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 4. FOOTER CALLOUT */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
          Still have questions?
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Read our in-depth step-by-step walkthroughs or visit our contact page for bug reports and feature suggestions.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            to="/help"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition min-h-[40px]"
          >
            <span>How It Works Guide</span>
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition min-h-[40px]"
          >
            <span>Contact & Feedback</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default FAQPage;

