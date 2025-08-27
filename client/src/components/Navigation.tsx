import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Zap } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  return (
    <div className="border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold">Mind Reader</h1>
            <nav className="flex space-x-2">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  data-testid="nav-original-profiler"
                >
                  <Brain className="h-4 w-4" />
                  Original Profiler
                </Button>
              </Link>
              <Link href="/advanced">
                <Button 
                  variant={location === "/advanced" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  data-testid="nav-advanced-profiler"
                >
                  <Zap className="h-4 w-4" />
                  Advanced Profiler
                  <Badge variant="secondary" className="ml-1 text-xs">
                    4-Phase
                  </Badge>
                </Button>
              </Link>
              <Link href="/protocols">
                <Button 
                  variant={location === "/protocols" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  data-testid="nav-six-protocols"
                >
                  <Brain className="h-4 w-4" />
                  Six Protocols
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Pure Passthrough
                  </Badge>
                </Button>
              </Link>
            </nav>
          </div>
          <div className="text-sm text-muted-foreground">
            {location === "/" ? "Original 6-Mode System" : 
             location === "/advanced" ? "Advanced 4-Phase Protocol" :
             location === "/protocols" ? "Six Protocols Implementation" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}