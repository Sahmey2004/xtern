'use client';
import { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...');
  const [supabaseStatus, setSupabaseStatus] = useState<string>('checking...');

  useEffect(() => {
    // Test backend connection
    fetchHealth()
      .then(data => setBackendStatus(data.status === 'ok' ? 'Connected' : 'Error'))
      .catch(() => setBackendStatus('Disconnected'));

    // Test Supabase connection
    supabase.from('products').select('count', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) setSupabaseStatus('Error: ' + error.message);
        else setSupabaseStatus(`Connected (${count ?? 0} products)`);
      })
      .catch(() => setSupabaseStatus('Disconnected'));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">Backend API</h2>
          <p className={`text-lg font-bold mt-2 ${
            backendStatus === 'Connected' ? 'text-green-600' : 'text-red-600'
          }`}>{backendStatus}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">Supabase</h2>
          <p className={`text-lg font-bold mt-2 ${
            supabaseStatus.startsWith('Connected') ? 'text-green-600' : 'text-red-600'
          }`}>{supabaseStatus}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-500">MCP Servers</h2>
          <p className="text-lg font-bold mt-2 text-gray-400">
            4 stubs ready
          </p>
        </div>
      </div>
    </div>
  );
}
