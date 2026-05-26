import axios from 'axios';

// Create axios instance with base configuration
const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 second timeout to prevent premature timeout during AI generation
});

// Request interceptor - automatically add token to requests
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
    }
);

// Response interceptor - handle common errors
axiosInstance.interceptors.response.use(
    (response) => {
        console.log(`[API Response] ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
    },
    (error) => {
        if (error.response) {
            // Server responded with error status
            console.error(`[API Error] ${error.response.status}:`, error.response.data);

            // Handle 401 Unauthorized - token expired or invalid
            if (error.response.status === 401) {
                console.warn('[Auth] Unauthorized - clearing token');
                localStorage.removeItem('token');
                // Only redirect if not already on login page
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
            }
        } else if (error.request) {
            // Request made but no response received
            console.error('[API Error] No response received:', error.request);
            console.error('[API Error] Is the server running on port 5001?');
        } else {
            // Error in request setup
            console.error('[API Error] Request setup error:', error.message);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
