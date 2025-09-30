import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { BuyCreditsDialog } from '@/components/BuyCreditsDialog';
import { Button } from '@/components/ui/button';
import { Coins, LogOut, User, ShoppingCart } from 'lucide-react';

export function AppHeader() {
  const { user, logout } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Mind Reader</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md" data-testid="credit-display">
                  <Coins className="h-4 w-4" />
                  <span className="font-semibold" data-testid="text-credits">
                    {user.isUnlimited ? '∞' : user.credits.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                
                {!user.isUnlimited && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => setBuyCreditsOpen(true)}
                    data-testid="button-buy-credits"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Buy Credits
                  </Button>
                )}
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm">
                    <User className="h-4 w-4" />
                    <span data-testid="text-username">{user.username}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogout}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setAuthDialogOpen(true)}
                data-testid="button-login"
              >
                <User className="h-4 w-4 mr-1" />
                Login / Register
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      <BuyCreditsDialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen} />
    </>
  );
}
