import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users } from 'lucide-react';

/**
 * AdminNavTabs — Secondary administrative navigation bar for switching between
 * Overview (/admin) and User Management (/admin/users).
 */
const AdminNavTabs = () => {
  return (
    <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
      <NavLink
        to="/admin"
        end
        id="admin-tab-overview"
        className={({ isActive }) =>
          `flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            isActive
              ? 'border-amber-500 text-amber-700 dark:text-amber-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`
        }
      >
        <LayoutDashboard className="h-4 w-4" />
        <span>Overview</span>
      </NavLink>

      <NavLink
        to="/admin/users"
        id="admin-tab-users"
        className={({ isActive }) =>
          `flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            isActive
              ? 'border-amber-500 text-amber-700 dark:text-amber-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`
        }
      >
        <Users className="h-4 w-4" />
        <span>User Management</span>
      </NavLink>
    </div>
  );
};

export default AdminNavTabs;
