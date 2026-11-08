import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    })
  } else {
    window.addEventListener('load', () => {
      const serviceWorkerUrl = new URL('/sw.js', window.location.origin).href
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations
          .filter((registration) => [registration.active, registration.waiting, registration.installing]
            .some((worker) => worker?.scriptURL === serviceWorkerUrl))
          .map((registration) => registration.unregister()))
      ).catch((error) => {
        console.error('Development service worker cleanup failed:', error)
      })
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
