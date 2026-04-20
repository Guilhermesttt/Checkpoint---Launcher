import React from "react";
import { AnimatePresence } from "framer-motion";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import GameBootIntro from "./components/GameBootIntro";
import AsyncLoader from "./components/AsyncLoader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationCenter";
import MainVideoBackground from "./components/MainVideoBackground";

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isIntroVisible, setIsIntroVisible] = React.useState(false);
  const previousUserUid = React.useRef<string | null>(null);
  const isInitialLoad = React.useRef(true);

  React.useEffect(() => {
    if (loading) return;
    const currentUid = user?.uid ?? null;
    const previousUid = previousUserUid.current;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      previousUserUid.current = currentUid;
      return;
    }

    const isLoggingInNow = Boolean(currentUid) && previousUid !== currentUid;
    previousUserUid.current = currentUid;

    if (isLoggingInNow) {
      setIsIntroVisible(true);
      const timer = window.setTimeout(() => setIsIntroVisible(false), 12000);
      return () => window.clearTimeout(timer);
    }

    if (!currentUid) {
      setIsIntroVisible(false);
    }
    return;
  }, [loading, user?.uid]);

  if (loading) {
    return <AsyncLoader />;
  }

  /* 
   * Route logic:
   * - user logged in  → Home (game library)
   * - user not logged in → Landing (public marketing page with login)
   * 
   * The video background only renders when logged in (Home),
   * landing handles its own background internally.
   */
  if (!user) {
    return <Landing />;
  }

  return (
    <>
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
    </>
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
