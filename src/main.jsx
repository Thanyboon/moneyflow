import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ลงทะเบียน Service Worker เฉพาะเว็บจริง
if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener("load", async () => {
    try {
      const registration =
        await navigator.serviceWorker.register(
          "/moneyflow/sw.js",
          { scope: "/moneyflow/" }
        );

      console.log(
        "MoneyFlow PWA ready:",
        registration.scope
      );
    } catch (error) {
      console.warn(
        "Service Worker registration failed:",
        error
      );
    }
  });
}
