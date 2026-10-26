import React from "react";
import ReactDOM from "react-dom/client";
import { ReadingPreferencesProvider } from "./components/ReadingPreferences";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ReadingPreferencesProvider><App /></ReadingPreferencesProvider></React.StrictMode>,
);
