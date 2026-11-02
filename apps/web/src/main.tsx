import React from "react";
import ReactDOM from "react-dom/client";
import { ReadingPreferencesProvider } from "./components/ReadingPreferences";
import { CapabilityCatalog } from "./components/CapabilityCatalog";
import { AndroidWalletGuide } from "./components/AndroidWalletGuide";
import App from "./App";
import "./index.css";

const path = location.pathname.replace(/\/$/, "");
let page = <App />;
if (path === "/android") page = <AndroidWalletGuide />;
if (path === "/parties" || path === "/capabilities") page = <CapabilityCatalog capacities={path === "/capabilities"} />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ReadingPreferencesProvider>{page}</ReadingPreferencesProvider></React.StrictMode>,
);
