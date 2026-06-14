import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, getStoredToken, removeStoredToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/components/Login";
import { useToast } from "@/hooks/use-toast";
import { LogOut } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    // Clear any old invalid tokens and check for valid token
    const token = getStoredToken();
    if (token && !token.startsWith('temp.')) {
      // Old format token, clear it
      removeStoredToken();
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(!!token);
    }
  }, []);

  useEffect(() => {
    // When the server rejects our token (e.g. it expired after the app sat idle),
    // automatically return to the login screen instead of showing a broken page.
    const onUnauthorized = () => {
      setIsAuthenticated(false);
      queryClient.clear();
      toast({
        title: 'Session expired',
        description: 'Please sign in again to continue.',
      });
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [toast]);
  
  const handleLogin = () => {
    // Check token again after login
    const token = getStoredToken();
    if (token && token.startsWith('temp.')) {
      setIsAuthenticated(true);
    }
  };
  
  const handleLogout = () => {
    removeStoredToken();
    setIsAuthenticated(false);
    queryClient.clear(); // Clear all cached queries
  };
  
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Login onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
              <h1 className="text-xl font-semibold">Promo Code Manager</h1>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </header>
          <main>
            <Router />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
