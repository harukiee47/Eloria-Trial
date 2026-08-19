import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';

// App.js has its own top-level handler that takes over rendering when the
// URL is /code (it mounts EloriaCode into #root itself). If we also render
// <App/> here for that same path, two React roots fight over the same DOM
// node and /code breaks. So on /code, just import App.js for its side
// effect (the special-case mount) and skip the normal render below.
if (window.location.pathname === '/code') {
  import('./App');
} else {
  import('./App').then(({ default: App }) => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

