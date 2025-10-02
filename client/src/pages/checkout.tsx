import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowLeft } from "lucide-react";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
console.log('Stripe key exists:', !!STRIPE_KEY);

if (!STRIPE_KEY) {
  console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable');
}

const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const CheckoutForm = ({ credits }: { credits: number }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error('Stripe or elements not initialized');
      return;
    }

    setIsProcessing(true);
    console.log('Confirming payment...');

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/checkout-success',
        },
      });

      setIsProcessing(false);

      if (error) {
        console.error('Payment error:', error);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Unexpected payment error:', err);
      setIsProcessing(false);
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || isProcessing}
        data-testid="button-submit-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${credits}.00`}
      </Button>
    </form>
  );
};

const PRICING_OPTIONS = [
  { credits: 5, price: 5, popular: false },
  { credits: 10, price: 10, popular: true },
  { credits: 20, price: 20, popular: false },
  { credits: 50, price: 50, popular: false },
];

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");
  const [selectedCredits, setSelectedCredits] = useState<number | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    console.log('Checkout useEffect - user:', user?.username, 'authenticated:', !!user);
    
    if (!user) {
      console.log('No user, redirecting to auth');
      toast({
        title: "Authentication required",
        description: "Please log in to purchase credits",
        variant: "destructive",
      });
      setLocation('/auth');
      return;
    }

    // Get credits from URL params if available
    const params = new URLSearchParams(window.location.search);
    const creditAmount = parseInt(params.get('credits') || '0');
    if (creditAmount > 0) {
      setSelectedCredits(creditAmount);
    }
  }, [user, setLocation, toast]);

  const handleSelectPackage = (credits: number) => {
    if (!user) return;
    
    console.log('Creating payment intent for', credits, 'credits');
    setSelectedCredits(credits);

    // Create PaymentIntent
    console.log('Calling /api/create-payment-intent...');
    apiRequest("POST", "/api/create-payment-intent", { credits })
      .then((res) => {
        console.log('Payment intent response status:', res.status);
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.error || `Server error: ${res.status}`);
          });
        }
        return res.json();
      })
      .then((data) => {
        console.log('Payment intent data received:', { hasClientSecret: !!data.clientSecret });
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          console.log('Client secret set successfully');
        } else {
          throw new Error('No client secret received from server');
        }
      })
      .catch((error) => {
        console.error('Payment initialization error:', error);
        setSelectedCredits(null);
        toast({
          title: "Error",
          description: error.message || "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      });
  };

  if (!user) {
    return null;
  }

  if (!STRIPE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Payment Configuration Error</CardTitle>
            <CardDescription className="text-red-600">
              Stripe is not configured properly. Please contact support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Error: Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setLocation('/')}
              className="mt-4 w-full"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show pricing selection if no package selected yet
  if (!selectedCredits || !clientSecret) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/')}
            className="mb-6"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Purchase Credits</h1>
            <p className="text-gray-600">Select a credit package to get started with your analyses</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {PRICING_OPTIONS.map((option) => (
              <Card 
                key={option.credits}
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  option.popular ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleSelectPackage(option.credits)}
                data-testid={`package-${option.credits}`}
              >
                {option.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{option.credits} Credits</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${option.price}</span>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    ${(option.price / option.credits).toFixed(2)} per credit
                  </p>
                  <Button 
                    className="w-full" 
                    variant={option.popular ? "default" : "outline"}
                    disabled={selectedCredits === option.credits && !clientSecret}
                  >
                    {selectedCredits === option.credits && !clientSecret ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Loading...
                      </>
                    ) : (
                      'Select Package'
                    )}
                  </Button>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500">
                      {option.credits === 5 && "Perfect for trying out"}
                      {option.credits === 10 && "Great for regular use"}
                      {option.credits === 20 && "Best value for power users"}
                      {option.credits === 50 && "Maximum savings"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">What are credits?</h3>
                  <p className="text-sm text-gray-600">
                    Credits are used to run analyses on Mind Reader. Each analysis type requires 1 credit. 
                    Credits never expire and can be used anytime.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show payment form when package is selected
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => {
            setSelectedCredits(null);
            setClientSecret("");
          }}
          className="mb-6"
          data-testid="button-back-to-pricing"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pricing
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-6 w-6 text-primary" />
              <CardTitle>Complete Your Purchase</CardTitle>
            </div>
            <CardDescription>
              You're purchasing {selectedCredits} credits for ${selectedCredits}.00
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise!} options={{ clientSecret }}>
              <CheckoutForm credits={selectedCredits} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
