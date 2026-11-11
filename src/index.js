import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Student note: Entry point connecting React App to index.html root div
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);