const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

import axios from 'axios';

const api = axios.create({
  baseURL: API_URL
});

// Attach Authorization Bearer token before request is sent
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept 401 Unauthorized responses to logout user
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.log('Session expired or unauthorized. Logging out...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // If we are not on the login page, redirect
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export const getUploadUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const backendServer = API_URL.replace(/\/api\/?$/, '');
  return `${backendServer}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const downloadFile = async (filePath, customFileName) => {
  try {
    if (!filePath) return;
    const cleanFileName = filePath.split('/').pop().split('\\').pop();
    const downloadUrl = `${API_URL}/download-file?file=${encodeURIComponent(cleanFileName)}`;
    
    const token = localStorage.getItem('token');
    const response = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Download HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = customFileName || cleanFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('downloadFile helper error:', error);
    // Direct fallback
    const directUrl = getUploadUrl(filePath);
    window.open(directUrl, '_blank');
  }
};

export default api;
