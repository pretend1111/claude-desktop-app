import './src/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';

const rootElement = document.getElementById('root');

// Initialize theme and font from localStorage to ensure CSS variables are hydrated before render
const theme = localStorage.getItem('theme') || 'auto';
const font = localStorage.getItem('chat_font') || 'default';
if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.setAttribute('data-theme', 'light');
}
document.documentElement.setAttribute('data-chat-font', font);

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);