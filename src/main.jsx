import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// Global 401 handling.
//
// There is no shared API client — ~41 components call fetch('/api/...') directly
// and AiPromptCanvas uses axios (XHR), which a fetch wrapper cannot see. Rather
// than touch every call site, both transports get an interceptor here.
//
// They key on the X-Auth-Required header, not on the status code: a wrong TOTP
// code on the login form is also a 401, and reacting to that would wipe the
// half-filled form. Only requireAuth sets the header.
if (!window.__fsAuthInterceptorsInstalled) {
  window.__fsAuthInterceptorsInstalled = true;

  const signalExpired = () => window.dispatchEvent(new CustomEvent('auth-expired'));

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await nativeFetch(input, init);
    // Return the Response untouched so it stays streamable.
    if (res.status === 401 && res.headers.get('X-Auth-Required')) signalExpired();
    return res;
  };

  axios.interceptors.response.use(
    res => res,
    err => {
      if (err?.response?.status === 401 && err.response.headers?.['x-auth-required']) signalExpired();
      return Promise.reject(err);
    }
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
