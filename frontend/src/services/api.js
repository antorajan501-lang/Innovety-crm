const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  if (import.meta.env.PROD) {
    console.error('[Production Config Warning] VITE_API_URL environment variable is required for production deployment.');
    return '/api';
  }
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

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
  if (!path || typeof path !== 'string') return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return encodeURI(path);
  }

  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Prepend /api if path starts with /uploads/ so reverse proxies (like Nginx) routing /api pass requests to backend
  if (cleanPath.startsWith('/uploads/')) {
    cleanPath = `/api${cleanPath}`;
  }

  const backendServer = API_URL.replace(/\/api\/?$/, '');
  return encodeURI(`${backendServer}${cleanPath}`);
};

export const downloadChatAttachment = async (messageOrPath, customFileName) => {
  try {
    let downloadUrl = '';
    let defaultName = '';

    if (typeof messageOrPath === 'object' && messageOrPath !== null) {
      const msg = messageOrPath;
      defaultName = msg.fileName || msg.originalFileName || customFileName || msg.name || '';
      if (!defaultName && msg.attachmentUrl) {
        defaultName = msg.attachmentUrl.split('/').pop().split('\\').pop();
      }
      if (msg.id) {
        downloadUrl = `${API_URL}/chat/messages/${msg.id}/download`;
      } else if (msg.attachmentUrl) {
        downloadUrl = `${API_URL}/download-file?file=${encodeURIComponent(msg.attachmentUrl)}&name=${encodeURIComponent(defaultName)}`;
      } else if (msg.url) {
        downloadUrl = `${API_URL}/download-file?file=${encodeURIComponent(msg.url)}&name=${encodeURIComponent(msg.name || defaultName)}`;
      }
    } else if (typeof messageOrPath === 'string') {
      const inputStr = messageOrPath.trim();
      defaultName = customFileName || '';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputStr)) {
        downloadUrl = `${API_URL}/chat/messages/${inputStr}/download`;
      } else {
        downloadUrl = `${API_URL}/download-file?file=${encodeURIComponent(inputStr)}&name=${encodeURIComponent(defaultName)}`;
      }
    }

    if (!downloadUrl) return false;

    const token = localStorage.getItem('token');
    const response = await fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Download HTTP error! status: ${response.status}`);
    }

    // Extract original filename from Content-Disposition header (supports filename*=UTF-8'' and filename="...")
    let filename = '';
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
    }

    if (!filename || filename === 'undefined') {
      filename = defaultName || 'download';
    }

    // Clean any surrounding quotes
    filename = filename.replace(/^"|"$/g, '').trim();

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  } catch (error) {
    console.error('Authenticated chat download error:', error);
    throw error;
  }
};

export const downloadFile = async (filePath, customFileName) => {
  return downloadChatAttachment(filePath, customFileName);
};

import { io } from 'socket.io-client';

let socketInstance = null;
export const getSocket = () => {
  if (!socketInstance) {
    let backendServer = '';
    if (API_URL.startsWith('http://') || API_URL.startsWith('https://')) {
      backendServer = API_URL.replace(/\/api\/?$/, '');
    } else {
      backendServer = window.location.origin;
    }

    socketInstance = io(backendServer, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  }
  return socketInstance;
};

export default api;
