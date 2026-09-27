/**
 * ==============================================================================
 * BIHAR SAMACHAR HUB - BACKEND CONFIGURATION
 * ==============================================================================
 * 
 * RENDER DEPLOYMENT INSTRUCTION:
 * 1. Deploy your backend on Render.com (see backend/README.md).
 * 2. Copy your Render web service URL (e.g., https://bihar-samachar-hub-backend.onrender.com).
 * 3. Paste it inside BACKEND_URL below:
 * 
 *    const BACKEND_URL = 'https://your-backend-app.onrender.com';
 * 
 * If left empty (''), the frontend automatically falls back to local /api routes 
 * and static data fallbacks so the site always stays working!
 * ==============================================================================
 */

const BACKEND_URL = ''; // <-- PASTE YOUR DEPLOYED BACKEND URL HERE (e.g. 'https://bihar-news-backend.onrender.com')

function getApiBase() {
    if (BACKEND_URL && !BACKEND_URL.includes('[YOUR-BACKEND-URL]') && BACKEND_URL.trim() !== '') {
        return BACKEND_URL.trim().replace(/\/+$/, '') + '/api';
    }
    // Default to origin/api or relative /api
    return (typeof window !== 'undefined' && window.location && window.location.origin) 
        ? `${window.location.origin}/api` 
        : '/api';
}

const API_BASE = getApiBase();

if (typeof window !== 'undefined') {
    window.BACKEND_URL = BACKEND_URL;
    window.API_BASE = API_BASE;
    window.getApiBase = getApiBase;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BACKEND_URL, API_BASE, getApiBase };
}
