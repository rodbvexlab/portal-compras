import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import {
  HelmetProvider,
} from "react-helmet-async"



const container = document.getElementById("root") as HTMLDivElement;
createRoot(container).render(
  <HelmetProvider>
    <App />
    <Toaster
      position="top-right"
      duration={4000}
      richColors
      closeButton
    />
  </HelmetProvider>
);
    
