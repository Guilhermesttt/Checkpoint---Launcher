import React from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";
import GameBootIntro from "./components/GameBootIntro";
import AsyncLoader from "./components/AsyncLoader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationCenter";
import MainVideoBackground from "./components/MainVideoBackground";

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isIntroVisible, setIsIntroVisible] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    const currentUid = user?.uid ?? null;

    if (!currentUid) {
      sessionStorage.removeItem("hasSeenIntro");
      setIsIntroVisible(false);
      return;
    }

    if (currentUid && !sessionStorage.getItem("hasSeenIntro")) {
      sessionStorage.setItem("hasSeenIntro", "true");
      setIsIntroVisible(true);
      const timer = window.setTimeout(() => setIsIntroVisible(false), 10000);
      return () => window.clearTimeout(timer);
    }
  }, [loading, user?.uid]);

  if (loading) {
    return <AsyncLoader />;
  }

  // Redirect unauthenticated users to /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="overflow-hidden select-none h-screen w-full">
      <MainVideoBackground />
      <Home />
      <AnimatePresence>
        {isIntroVisible && (
          <GameBootIntro
            key="boot-intro"
            onFinish={() => setIsIntroVisible(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </NotificationProvider>
);

export default App;
