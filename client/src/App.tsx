import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Brain, Home as HomeIcon } from "lucide-react";
import Home from "@/pages/home";
import MindReader from "@/pages/mind-reader";
import NotFound from "@/pages/not-found";

function Navigation() {
  const [location] = useLocation();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <nav className="flex space-x-4 py-4">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"} 
              className="flex items-center space-x-2"
              data-testid="nav-home"
            >
              <HomeIcon className="h-4 w-4" />
              <span>Tab 1</span>
            </Button>
          </Link>
          <Link href="/mind-reader">
            <Button 
              variant={location === "/mind-reader" ? "default" : "ghost"} 
              className="flex items-center space-x-2"
              data-testid="nav-mind-reader"
            >
              <Brain className="h-4 w-4" />
              <span>Tab 2</span>
            </Button>
          </Link>
        </nav>
      </div>
    </div>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/mind-reader" component={MindReader} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
