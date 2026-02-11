import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop warning (harmless, from Recharts/Radix UI)
const origError = window.onerror;
window.onerror = (msg, ...args) => {
  if (typeof msg === 'string' && msg.includes('ResizeObserver')) return true;
  return origError ? origError(msg, ...args) : false;
};
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) { e.stopImmediatePropagation(); e.preventDefault(); }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />
);

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
