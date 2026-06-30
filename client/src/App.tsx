import { useState, useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient, getStoredToken, removeStoredToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Campaigns from "@/pages/campaigns";
import Login from "@/components/Login";
import { useToast } from "@/hooks/use-toast";
import { useTheme, type Theme } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Palette, Check, Ticket, Send, PanelLeft, PanelTop } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Promo Codes", icon: Ticket },
  { path: "/campaigns", label: "Campaigns", icon: Send },
];

type NavStyle = "top" | "side";
const NAV_STYLE_KEY = "promo_nav_style";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/campaigns" component={Campaigns} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NavLinks({ orientation }: { orientation: NavStyle }) {
  const [location] = useLocation();
  const isVertical = orientation === "side";
  return (
    <nav className={isVertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            data-testid={`nav-${item.path === "/" ? "home" : item.path.slice(1)}`}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
              isVertical ? "w-full" : ""
            } ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string }[] = [
    { value: "default", label: "Default (Blue)" },
    { value: "restaurant", label: "Restaurant Light (Gold)" },
    { value: "restaurant-dark", label: "Restaurant Dark (Gold)" },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-theme">
          <Palette className="h-4 w-4 mr-2" />
          Theme
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            data-testid={`theme-option-${opt.value}`}
          >
            <Check
              className={`h-4 w-4 mr-2 ${theme === opt.value ? "opacity-100" : "opacity-0"}`}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [navStyle, setNavStyle] = useState<NavStyle>("top");
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem(NAV_STYLE_KEY);
    if (stored === "top" || stored === "side") {
      setNavStyle(stored);
    }
  }, []);

  const toggleNavStyle = () => {
    setNavStyle((prev) => {
      const next = prev === "top" ? "side" : "top";
      localStorage.setItem(NAV_STYLE_KEY, next);
      return next;
    });
  };
  
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
          <header className="border-b app-header">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
              <h1 className="text-xl font-semibold">Promo Code Manager</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleNavStyle}
                  data-testid="button-nav-style"
                  title={navStyle === "top" ? "Switch to side menu" : "Switch to top tabs"}
                >
                  {navStyle === "top" ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelTop className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">
                    {navStyle === "top" ? "Side menu" : "Top tabs"}
                  </span>
                </Button>
                <ThemeToggle />
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
            </div>
            {navStyle === "top" && (
              <div className="container mx-auto px-4 pb-2">
                <NavLinks orientation="top" />
              </div>
            )}
          </header>
          {navStyle === "side" ? (
            <div className="container mx-auto px-4 py-4 flex gap-6">
              <aside className="w-48 shrink-0">
                <div className="sticky top-4">
                  <NavLinks orientation="side" />
                </div>
              </aside>
              <main className="flex-1 min-w-0">
                <Router />
              </main>
            </div>
          ) : (
            <main>
              <Router />
            </main>
          )}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
