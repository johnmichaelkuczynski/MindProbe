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

if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLISHABLE_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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

export default function Checkout() {
  const [clientSecret, setClientSecret] = useState("");
  const [credits, setCredits] = useState(10);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
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
    const creditAmount = parseInt(params.get('credits') || '10');
    setCredits(creditAmount);

    // Create PaymentIntent
    apiRequest("POST", "/api/create-payment-intent", { credits: creditAmount })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('No client secret received');
        }
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
        console.error('Payment initialization error:', error);
      });
  }, [user, setLocation, toast]);

  if (!user) {
    return null;
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-6 w-6 text-primary" />
              <CardTitle>Purchase Credits</CardTitle>
            </div>
            <CardDescription>
              You're purchasing {credits} credits for ${credits}.00
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm credits={credits} />
            </Elements>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
