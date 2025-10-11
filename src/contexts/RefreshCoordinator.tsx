import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface RefreshCoordinatorContextType {
  lastRefresh: number;
  triggerRefresh: () => void;
}

const RefreshCoordinatorContext = createContext<RefreshCoordinatorContextType>({
  lastRefresh: Date.now(),
  triggerRefresh: () => {}
});

export const RefreshCoordinatorProvider = ({ children }: { children: ReactNode }) => {
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const triggerRefresh = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  // Auto-refresh every 2 minutes (120s)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if page is visible
      if (!document.hidden) {
        triggerRefresh();
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [triggerRefresh]);

  // Refresh immediately when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        triggerRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [triggerRefresh]);

  return (
    <RefreshCoordinatorContext.Provider value={{ lastRefresh, triggerRefresh }}>
      {children}
    </RefreshCoordinatorContext.Provider>
  );
};

export const useRefreshCoordinator = () => useContext(RefreshCoordinatorContext);
