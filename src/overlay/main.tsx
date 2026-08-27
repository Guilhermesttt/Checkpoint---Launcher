import React from "react";
import ReactDOM from "react-dom/client";
import OverlayApp from "./OverlayApp";
import "../index.css";
import { GamepadProvider } from "../context/GamepadContext";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GamepadProvider>
        <OverlayApp />
      </GamepadProvider>
    </React.StrictMode>
  );
}
