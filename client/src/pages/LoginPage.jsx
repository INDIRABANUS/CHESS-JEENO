import React from 'react';
import { LogIn } from 'lucide-react';

const LoginPage = () => {
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="text-center">
        <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Login to CHESS JEENO</h1>
        <p className="text-sm text-slate-500 mt-1">
          Authentication placeholder page
        </p>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-sm text-slate-600">
        <p>Lichess OAuth authentication for CHESS JEENO will be connected here in a future task.</p>
      </div>
    </div>
  );
};

export default LoginPage;
