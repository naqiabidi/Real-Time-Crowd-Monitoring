import { useState, useEffect, useRef } from 'react';  
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Users, TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface CrowdDataPoint {
  time: string;
  count: number;
  timestamp: number;
}

export function CrowdDashboard() {
  const [currentCount, setCurrentCount] = useState(0);
  const [crowdData, setCrowdData] = useState<CrowdDataPoint[]>([]);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [weaponDetected, setWeaponDetected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLImageElement>(null);

  // Initialize video stream
  useEffect(() => {
    // Start crowd count stream
    fetch(API_ENDPOINTS.START_CROWD_COUNT)
      .catch(err => console.error('Error starting crowd count:', err));

    // Set up video stream
    if (videoRef.current) {
      videoRef.current.src = `${API_ENDPOINTS.VIDEO_STREAM}?${Date.now()}`;
    }
  }, []);

  // Fetch crowd count and weapon status from backend
  useEffect(() => {
    const fetchCrowdData = async () => {
      try {
        setIsLoading(false);
        setError(null);

        // Fetch crowd count
        const countResponse = await fetch(API_ENDPOINTS.CROWD_COUNT);
        if (!countResponse.ok) throw new Error('Failed to fetch crowd count');
        const countData = await countResponse.json();
        const newCount = countData.count || 0;

        // Fetch weapon status
        const weaponResponse = await fetch(API_ENDPOINTS.WEAPON_STATUS);
        if (weaponResponse.ok) {
          const weaponData = await weaponResponse.json();
          setWeaponDetected(weaponData.weapon_detected || false);
        }

        // Update count and data
        setCrowdData(prevData => {
          const newTimestamp = Date.now();
          const newTime = new Date(newTimestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          });

          // Determine trend
          if (prevData.length > 0) {
            const lastCount = prevData[prevData.length - 1].count;
            if (newCount > lastCount + 3) setTrend('up');
            else if (newCount < lastCount - 3) setTrend('down');
            else setTrend('stable');
          }

          const newDataPoint: CrowdDataPoint = {
            time: newTime,
            count: newCount,
            timestamp: newTimestamp
          };

          // Keep last 30 data points
          const updatedData = [...prevData, newDataPoint];
          return updatedData.slice(-30);
        });

        setCurrentCount(newCount);
      } catch (err) {
        console.error('Error fetching crowd data:', err);
        setError('Failed to connect to backend. Make sure the Flask server is running.');
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchCrowdData();

    // Set up polling interval (every 2 seconds)
    const interval = setInterval(fetchCrowdData, 2000);

    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const avgCount = crowdData.length > 0 
    ? Math.round(crowdData.reduce((sum, d) => sum + d.count, 0) / crowdData.length)
    : 0;
  
  const maxCount = crowdData.length > 0
    ? Math.max(...crowdData.map(d => d.count))
    : 0;

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Connection Error</p>
            <p className="text-gray-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Weapon Detection Alert */}
      {weaponDetected && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <div>
            <p className="text-red-400 font-bold text-lg">⚠️ WEAPON DETECTED</p>
            <p className="text-gray-300 text-sm mt-1">A weapon has been detected in the camera feed</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Current Count</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-white text-2xl font-semibold">{isLoading ? '...' : currentCount}</span>
            {!isLoading && trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500 mb-1" />}
            {!isLoading && trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500 mb-1" />}
            {!isLoading && trend === 'stable' && <Activity className="w-5 h-5 text-yellow-500 mb-1" />}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Average Count</span>
            <Activity className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-white">{avgCount}</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Peak Count</span>
            <TrendingUp className="w-5 h-5 text-orange-500" />
          </div>
          <span className="text-white">{maxCount}</span>
        </div>
      </div>

      {/* Live Feed and Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Camera Feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white">Live Camera Feed</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-500">LIVE</span>
            </div>
          </div>
          
          <div className="relative aspect-video bg-gray-950 rounded-lg overflow-hidden">
            {error ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500">Unable to load video stream</p>
                </div>
              </div>
            ) : (
              <img 
                ref={videoRef}
                src={`${API_ENDPOINTS.VIDEO_STREAM}?t=${Date.now()}`}
                alt="Live crowd feed"
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error('Video stream error');
                  setError('Failed to load video stream');
                }}
              />
            )}
            
            {/* Detection Overlays */}
            <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded">
              <span className="text-green-400">● Detecting: {currentCount} persons</span>
            </div>
          </div>
        </div>

        {/* Real-time Graph */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-white mb-4">Crowd Density Over Time</h2>
          
          {crowdData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-gray-500">Waiting for data...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={crowdData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => {
                  const parts = value.split(':');
                  return `${parts[1]}:${parts[2]}`;
                }}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#fff'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCount)" 
              />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-white mb-4">Recent Activity Log</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 pb-3">Time</th>
                <th className="text-left text-gray-400 pb-3">Count</th>
                <th className="text-left text-gray-400 pb-3">Change</th>
                <th className="text-left text-gray-400 pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {crowdData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No data available yet
                  </td>
                </tr>
              ) : (
                crowdData.slice(-10).reverse().map((data, index, arr) => {
                const prevCount = index < arr.length - 1 ? arr[index + 1].count : data.count;
                const change = data.count - prevCount;
                
                return (
                  <tr key={data.timestamp} className="border-b border-gray-800/50">
                    <td className="py-3 text-gray-300">{data.time}</td>
                    <td className="py-3 text-white">{data.count}</td>
                    <td className={`py-3 ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {change > 0 ? '+' : ''}{change}
                    </td>
                    <td className="py-3">
                      {data.count > 200 && <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm">High</span>}
                      {data.count >= 100 && data.count <= 200 && <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">Normal</span>}
                      {data.count < 100 && <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">Low</span>}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
