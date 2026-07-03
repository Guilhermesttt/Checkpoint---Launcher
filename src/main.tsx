import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const Landing = lazy(() => import("./Landing"));
const Login = lazy(() => import("./pages/Login"));
const AppRoot = lazy(() => import("./App"));

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center bg-[#050507] text-sm font-bold text-white/50">
    Carregando...
  </div>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={routeFallback}>
        <Landing />
      </Suspense>
    ),
  },
  {
    path: "/login",
    element: (
      <Suspense fallback={routeFallback}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/app",
    element: (
      <Suspense fallback={routeFallback}>
        <AppRoot />
      </Suspense>
    ),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
