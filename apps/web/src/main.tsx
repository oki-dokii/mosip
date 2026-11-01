import React from "react";
import ReactDOM from "react-dom/client";
import { ReadingPreferencesProvider } from "./components/ReadingPreferences";
import { CapabilityCatalog } from "./components/CapabilityCatalog";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ReadingPreferencesProvider>{["/parties", "/capabilities"].includes(location.pathname.replace(/\/$/, "")) ? <CapabilityCatalog capacities={location.pathname.startsWith("/capabilities")} /> : <App />}</ReadingPreferencesProvider></React.StrictMode>,
);
