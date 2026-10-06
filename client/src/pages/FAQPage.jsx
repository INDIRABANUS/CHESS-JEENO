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
        'You can browse public tournaments and view ongoing standings without an account. However, creating tournaments, requesting to join events, and participating in games require a registered CHESS JEENO account.',
    },
    {
      id: 'faq-google-login',
      category: 'account',
      question: 'Can I sign in with Google?',
      answer:
        'Yes. In addition to standard email and password authentication, CHESS JEENO supports Google OAuth 2.0 sign-in for quick and secure access.',
    },
    {
      id: 'faq-lichess-auth',
      category: 'account',
      question: 'How does Lichess authentication work?',
      answer:
        'You can link your personal Lichess account from your Profile page using OAuth 2.0 PKCE. This securely connects your Lichess username so CHESS JEENO can verify your account, create game pairings, and track live matches on Lichess.',
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

    // Tournaments
    {
      id: 'faq-join-tournament',
      category: 'tournaments',
      question: 'How do I join a tournament?',
      answer:
        'Browse the Tournaments directory (/tournaments), click on a tournament with "Registration Open" status, and click the "Request to Join" button. Once submitted, your request is sent to the tournament host.',
    },
    {
      id: 'faq-pending-request',
      category: 'tournaments',
      question: 'Why is my join request pending?',
      answer:
        'Tournament hosts have approval control over their participant rosters. Your request remains in "PENDING" status until the tournament host reviews and approves your entry from their management dashboard.',
    },
    {
      id: 'faq-approves-participants',
      category: 'tournaments',
      question: 'Who approves participants?',
      answer:
        'The host who created the tournament reviews and manages join requests. Platform administrators also have administrative oversight over tournaments.',
    },
    {
      id: 'faq-supported-formats',
      category: 'tournaments',
      question: 'What tournament formats are supported?',
      answer:
        'CHESS JEENO currently supports three formats: Round Robin (all players face each other), Swiss System (players are paired against opponents with similar standings each round), and Knockout (single-elimination bracket until a winner is decided).',
    },
    {
      id: 'faq-ready-check',
      category: 'tournaments',
      question: 'How does the ready check work?',
      answer:
        'Before rounds commence, the tournament enters a Ready Check phase. Participants click "I am Ready" to confirm they are actively online and ready to play. Once the countdown expires, round pairings are generated.',
    },

    // Games
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
      id: 'faq-aborted-game',
      category: 'games',
      question: 'What happens if a game is aborted?',
      answer:
        'If a game on Lichess is aborted before meaningful play, CHESS JEENO detects the aborted status. Depending on the round state, the system records the aborted match and allows the pairing to be rematched or resolved by the tournament host.',
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
      question: 'How are tournament results reflected in standings?',
      answer:
        'Match outcomes are calculated using standard chess scoring: a win awards 1 point, a draw awards 0.5 points, and a loss awards 0 points. Standings tables update dynamically as games finish, ranking players by total points, wins, and head-to-head records.',
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
          Find answers to common questions about accounts, tournament hosting, pairings, and Lichess synchronization.
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
          Learn more about how tournaments operate or visit our contact page for bug reports and feature suggestions.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            to="/help"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
          >
            <span>How It Works Guide</span>
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <span>Contact & Feedback</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default FAQPage;
