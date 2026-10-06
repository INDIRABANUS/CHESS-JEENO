import React, { useEffect } from 'react';
import {
  Bug,
  Lightbulb,
  Trophy,
  MessageSquare,
  ExternalLink,
  Github,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ContactPage = () => {
  useEffect(() => {
    document.title = 'Contact | CHESS JEENO';
  }, []);

  const contactReasons = [
    {
      title: 'Bug Reports',
      desc: 'Encountered an issue with pairings, result synchronization, or tournament countdowns? Please report it with reproduction steps.',
      icon: Bug,
      badge: 'Technical',
      color: 'rose',
    },
    {
      title: 'Feature Suggestions',
      desc: 'Ideas for new pairing formats, interface enhancements, or tournament organizer workflows are welcome.',
      icon: Lightbulb,
      badge: 'Feedback',
      color: 'amber',
    },
    {
      title: 'Tournament Issues',
      desc: 'Questions regarding tournament statuses, host approvals, or match result recording.',
      icon: Trophy,
      badge: 'Tournaments',
      color: 'indigo',
    },
    {
      title: 'General Feedback',
      desc: 'Community feedback on how to make CHESS JEENO a better tournament companion for clubs and friends.',
      icon: MessageSquare,
      badge: 'Community',
      color: 'emerald',
    },
  ];

  return (
    <div className="space-y-12 py-4 transition-colors max-w-4xl mx-auto">
      {/* 1. HERO SECTION */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
          <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
          <span>CONTACT & FEEDBACK</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Get in Touch with <span className="text-indigo-600 dark:text-indigo-400">CHESS JEENO</span>
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
          CHESS JEENO is maintained as an open-source project. Inquiries, feedback, and bug reports are handled directly through GitHub.
        </p>
      </section>

      {/* 2. APPROPRIATE REASONS TO CONTACT */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Appropriate Reasons to Reach Out
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contactReasons.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. REPORT A BUG / GITHUB ISSUES */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>Report a Bug or Issue</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              File a tracking ticket on our official GitHub repository issue tracker.
            </p>
          </div>
          <a
            href="https://github.com/INDIRABANUS/CHESS-JEENO/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shrink-0 min-h-[44px]"
          >
            <span>Open GitHub Issues</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            When reporting a bug, please include:
          </h3>
          <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside">
            <li>A concise summary of what happened versus what you expected to happen.</li>
            <li>The tournament format (Round Robin, Swiss, or Knockout) and current round.</li>
            <li>The browser (Chrome, Firefox, Safari, Edge) and operating system used.</li>
            <li>Any visible error messages or console logs if applicable.</li>
          </ul>
        </div>
      </section>

      {/* 4. GITHUB REPOSITORY & PROJECT EMAIL NOTICE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GitHub Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold">
            <Github className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Official GitHub Repository
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            All code commits, release notes, and issue discussions are maintained in the repository:
          </p>
          <a
            href="https://github.com/INDIRABANUS/CHESS-JEENO"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 break-all"
          >
            <span>github.com/INDIRABANUS/CHESS-JEENO</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>

        {/* Contact Email Transparency Notice */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Email Inquiries
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            A dedicated project email inbox is not currently configured for direct messaging. Inquiries and contributions should be directed through GitHub. Direct email contact details will be added in a future update.
          </p>
          <div className="pt-1">
            <Link
              to="/faq"
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Looking for immediate answers? Check our FAQ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
