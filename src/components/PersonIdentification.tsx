import { useState, useEffect, useRef } from 'react';
import { Upload, Search, AlertCircle, CheckCircle, X, AlertTriangle, Download } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

interface Detection {
  id: number;
  timestamp: string;
  confidence: number;
  location: string;
  x: number;
  y: number;
}

export function PersonIdentification() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [searchComplete, setSearchComplete] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [statusPoller, setStatusPoller] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetectionEnabled, setFaceDetectionEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLImageElement>(null);

  // Cleanup poller and blob URLs on unmount
  useEffect(() => {
    return () => {
      if (statusPoller) {
        clearInterval(statusPoller);
      }
      if (screenshotUrl) {
        URL.revokeObjectURL(screenshotUrl);
      }
    };
  }, [statusPoller, screenshotUrl]);

  // Start video stream when face detection is enabled
  useEffect(() => {
    if (faceDetectionEnabled && videoRef.current) {
      const videoUrl = `${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`;
      videoRef.current.src = videoUrl;
      console.log('Starting face video stream:', videoUrl);
    }
  }, [faceDetectionEnabled]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setIsSearching(false);
        setDetections([]);
        setSearchComplete(false);
        setMatchFound(false);
        setScreenshotUrl(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!uploadedImage || !uploadedFile) return;
    
    setIsSearching(true);
    setDetections([]);
    setSearchComplete(false);
    setMatchFound(false);
    setScreenshotUrl(null);
    setError(null);

    try {
      // 1) Upload the face image to backend (saves to known_faces folder)
      const formData = new FormData();
      formData.append('image', uploadedFile);
      const uploadResp = await fetch(API_ENDPOINTS.UPLOAD_FACE, {
        method: 'POST',
        body: formData,
      });
      if (!uploadResp.ok) {
        const errJson = await uploadResp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to upload face image');
      }
      
      const uploadData = await uploadResp.json();
      console.log(`Face uploaded and saved: ${uploadData.filename}, Total faces: ${uploadData.total_faces}`);

      // 2) Toggle face detection on the backend
      const toggleResponse = await fetch(API_ENDPOINTS.TOGGLE_FACE_DETECTION);
      if (!toggleResponse.ok) throw new Error('Failed to start face detection');
      
      const toggleData = await toggleResponse.json();
      const isEnabled = toggleData.status.includes('started');
      setFaceDetectionEnabled(isEnabled);

      // 3) Start video stream for face detection immediately
      if (isEnabled && videoRef.current) {
        // Set the video stream source immediately
        const videoUrl = `${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`;
        videoRef.current.src = videoUrl;
        videoRef.current.onload = () => {
          console.log('Face video stream loaded');
        };
        videoRef.current.onerror = () => {
          console.error('Face video stream error');
          setError('Failed to load face detection stream. Make sure the backend is running.');
        };
      }

      // 4) Poll match status until found
      const pollId = window.setInterval(async () => {
        try {
          const res = await fetch(API_ENDPOINTS.FACE_MATCH_STATUS);
          if (!res.ok) return;
          const data = await res.json();
          if (data.match_found && data.screenshot_available) {
            setMatchFound(true);
            setSearchComplete(true);
            setIsSearching(false);

            // Fetch screenshot blob
            const shotRes = await fetch(API_ENDPOINTS.FACE_SCREENSHOT);
            if (shotRes.ok) {
              const blob = await shotRes.blob();
              const url = URL.createObjectURL(blob);
              setScreenshotUrl(url);
            }

            clearInterval(pollId);
            setStatusPoller(null);
            
            // Log match details including confidence if available
            if (data.confidence !== undefined) {
              console.log(`Match found: ${data.name} with ${data.confidence}% confidence (Method: ${data.method || 'unknown'})`);
            }
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 1500);

      setStatusPoller(pollId);

      // Safety timeout to stop after 60 seconds
      setTimeout(() => {
        setIsSearching(false);
        setSearchComplete(true);
        clearInterval(pollId);
        setStatusPoller(null);
      }, 60000);
    } catch (err) {
      console.error('Error starting face detection:', err);
      setError((err as Error).message || 'Failed to start face detection. Make sure the backend is running.');
      setIsSearching(false);
    }
  };

  const clearUpload = async () => {
    // Disable face detection when clearing
    if (faceDetectionEnabled) {
      try {
        await fetch(API_ENDPOINTS.TOGGLE_FACE_DETECTION);
        setFaceDetectionEnabled(false);
      } catch (err) {
        console.error('Error stopping face detection:', err);
      }
    }

    setUploadedImage(null);
    setUploadedFile(null);
    setIsSearching(false);
    setDetections([]);
    setSearchComplete(false);
    setMatchFound(false);
    if (statusPoller) {
      clearInterval(statusPoller);
      setStatusPoller(null);
    }
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-white mb-4">Upload Person Image</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Area */}
          <div>
            {!uploadedImage ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors bg-gray-950">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">Click to upload person image</p>
                  <p className="text-gray-500">PNG, JPG (max. 10MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Uploaded person"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={clearUpload}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {uploadedImage && (
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching Live Feeds...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Start Identification
                  </>
                )}
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <h3 className="text-white mb-3">How it works</h3>
              <ol className="space-y-2 text-gray-400 list-decimal list-inside">
                <li>Upload a clear photo of the person you want to find</li>
                <li>Click &quot;Start Identification&quot; to begin the search</li>
                <li>The system will analyze all live camera feeds</li>
                <li>Matches will appear in real-time with confidence scores</li>
                <li>Click on any detection to view details</li>
              </ol>
            </div>

            {isSearching && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-blue-400">Scanning in progress...</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Analyzing live camera feeds for matches
                  </p>
                </div>
              </div>
            )}

            {searchComplete && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-400">Search complete</p>
                  <p className="text-gray-400 text-sm mt-1">
                    {matchFound
                      ? 'Potential match found in live feed'
                      : 'No match found in the current session'}
                  </p>
                  {matchFound && screenshotUrl && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = screenshotUrl;
                        link.download = 'match_screenshot.jpg';
                        link.click();
                      }}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Screenshot
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Camera Feed with Detections */}
      {uploadedImage && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white">Live Camera Feed - Face Recognition</h2>
            <div className="flex items-center gap-2">
              {faceDetectionEnabled && (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500">LIVE</span>
                </>
              )}
            </div>
          </div>

          <div className="relative aspect-video bg-gray-950 rounded-lg overflow-hidden">
            {faceDetectionEnabled ? (
              <>
                <img 
                  ref={videoRef}
                  key={`face-video-${faceDetectionEnabled}`}
                  src={`${API_ENDPOINTS.FACE_VIDEO}?t=${Date.now()}`}
                  alt="Live face detection feed"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.error('Face video stream error', e);
                    setError('Failed to load face detection stream. Make sure the backend is running and camera is connected.');
                  }}
                  onLoad={() => {
                    console.log('Face video stream loaded successfully');
                    setError(null);
                  }}
                />
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white p-4">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500">Click "Start Identification" to begin face detection</p>
                </div>
              </div>
            )}

            {isSearching && (
              <div className="absolute top-4 left-4 bg-black/70 px-3 py-2 rounded flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-blue-400">Analyzing frames...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detection Results Table */}
      {detections.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-white mb-4">Detection Results</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 pb-3">Timestamp</th>
                  <th className="text-left text-gray-400 pb-3">Camera Location</th>
                  <th className="text-left text-gray-400 pb-3">Confidence</th>
                  <th className="text-left text-gray-400 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {detections.map((detection) => (
                  <tr key={detection.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 text-gray-300">{detection.timestamp}</td>
                    <td className="py-3 text-white">{detection.location}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-400 transition-all duration-300"
                            style={{ width: `${detection.confidence}%` }}
                          />
                        </div>
                        <span className="text-white">{detection.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-3">
                      {detection.confidence >= 85 && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">High Match</span>
                      )}
                      {detection.confidence >= 75 && detection.confidence < 85 && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">Probable</span>
                      )}
                      {detection.confidence < 75 && (
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-sm">Low Match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
