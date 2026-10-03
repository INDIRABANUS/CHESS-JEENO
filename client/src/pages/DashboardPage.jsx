import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PlayerDashboard from '../components/dashboard/PlayerDashboard';

/**
 * DashboardPage — Dedicated routed page view for the authenticated Player Dashboard at /dashboard.
 */
const DashboardPage = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <PlayerDashboard />;
};

export default DashboardPage;
