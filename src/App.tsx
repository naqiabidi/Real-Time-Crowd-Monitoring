import { useState } from 'react';
import { CrowdDashboard } from './components/CrowdDashboard';
import { PersonIdentification } from './components/PersonIdentification';
import { Users, UserSearch } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'identification'>('dashboard');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-white mb-4">Real-Time Crowd Dynamics</h1>
          
          {/* Navigation Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Users className="w-5 h-5" />
              Crowd Analysis
            </button>
            <button
              onClick={() => setActiveTab('identification')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'identification'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <UserSearch className="w-5 h-5" />
              Person Identification
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <CrowdDashboard />}
        {activeTab === 'identification' && <PersonIdentification />}
      </main>
    </div>
  );
}
