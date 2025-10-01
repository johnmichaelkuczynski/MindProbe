import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLocation('/auth');
    } else {
      // Refetch user data to get updated credits
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
  }, [user, setLocation]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Payment Successful!</CardTitle>
          <CardDescription className="text-center">
            Your credits have been added to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You can now use your credits to run analyses. Your current balance will be displayed in your account.
            </p>
          </div>
          <Button 
            onClick={() => setLocation('/')}
            className="w-full"
            data-testid="button-continue"
          >
            Continue to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
