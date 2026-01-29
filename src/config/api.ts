// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Crowd Detection
  VIDEO_STREAM: `${API_BASE_URL}/video`,
  CROWD_COUNT: `${API_BASE_URL}/crowd_count`,
  START_CROWD_COUNT: `${API_BASE_URL}/start_crowd_count`,
  WEAPON_STATUS: `${API_BASE_URL}/weapon_status`,
  
  // Face Recognition
  FACE_VIDEO: `${API_BASE_URL}/face_video`,
  TOGGLE_FACE_DETECTION: `${API_BASE_URL}/toggle_face_detection`,
  UPLOAD_FACE: `${API_BASE_URL}/upload_face`,
  FACE_MATCH_STATUS: `${API_BASE_URL}/face_match_status`,
  FACE_SCREENSHOT: `${API_BASE_URL}/face_screenshot`,
  SET_FACE_RECOGNITION_METHOD: `${API_BASE_URL}/set_face_recognition_method`,
};

export default API_BASE_URL;


