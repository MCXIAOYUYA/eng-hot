import React from "react";
import ReactDOM from "react-dom/client";
import "./fonts.css";   // 自托管字体,别换回 Google Fonts CDN(中国大陆访问不到)
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
