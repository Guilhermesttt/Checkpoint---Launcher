import React from "react";
import { AnimatePresence } from "framer-motion";
import Home from "./pages/Home";
import Login from "./pages/Login";
import GameBootIntro from "./components/GameBootIntro";
import AsyncLoader from "./components/AsyncLoader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationCenter";


const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isIntroVisible, setIsIntroVisible] = React.useState(false);
  const previousUserUid = React.useRef<string | null>(null);
  
  // This ref ensures the "Game Boot" intro only plays during an active login,
  // bypassing it if the user is already authenticated (e.g., page refresh).
  const isInitialLoad = React.useRef(true);

  React.useEffect(() => {
    if (loading) return;
    const currentUid = user?.uid ?? null;
    const previousUid = previousUserUid.current;
    
    // Check if this is the first time authentication state is resolved
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      previousUserUid.current = currentUid;
      return;
    }

    const isLoggingInNow = Boolean(currentUid) && previousUid !== currentUid;
    previousUserUid.current = currentUid;
    
    if (isLoggingInNow) {
      setIsIntroVisible(true);
      const timer = window.setTimeout(() => setIsIntroVisible(false), 3000);
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

  return (
    <>
      {user ? <Home /> : <Login />}
      <AnimatePresence>
        {isIntroVisible && (
          <GameBootIntro key="boot-intro" />
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
