import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Coins, Loader2 } from 'lucide-react';

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PricingTier {
  price: number;
  credits: number;
  label: string;
}

interface ModelPricing {
  name: string;
  tiers: PricingTier[];
}

export function BuyCreditsDialog({ open, onOpenChange }: BuyCreditsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>('zhi1');

  const { data: pricing, isLoading } = useQuery<Record<string, ModelPricing>>({
    queryKey: ['/api/credits/pricing'],
    enabled: open,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ model, priceInCents }: { model: string; priceInCents: number }) => {
      const response = await apiRequest('POST', '/api/credits/create-checkout', { model, priceInCents });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Checkout failed',
        description: error.message || 'Failed to create checkout session',
        variant: 'destructive',
      });
    },
  });

  const handlePurchase = (priceInCents: number) => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please login to purchase credits',
        variant: 'destructive',
      });
      return;
    }
    
    checkoutMutation.mutate({ model: selectedModel, priceInCents });
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              Please login or create an account to purchase credits
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            Purchase word credits for AI analysis. Different models have different credit costs.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : pricing ? (
          <Tabs value={selectedModel} onValueChange={setSelectedModel} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="zhi1" data-testid="tab-zhi1">ZHI 1</TabsTrigger>
              <TabsTrigger value="zhi2" data-testid="tab-zhi2">ZHI 2</TabsTrigger>
              <TabsTrigger value="zhi3" data-testid="tab-zhi3">ZHI 3</TabsTrigger>
              <TabsTrigger value="zhi4" data-testid="tab-zhi4">ZHI 4</TabsTrigger>
            </TabsList>

            {Object.entries(pricing).map(([model, data]) => (
              <TabsContent key={model} value={model} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{data.name}</CardTitle>
                    <CardDescription>Select a credit package below</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {data.tiers.map((tier) => (
                      <div
                        key={tier.price}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{tier.label}</p>
                          <p className="text-sm text-muted-foreground">
                            ${(tier.price / 100).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          onClick={() => handlePurchase(tier.price)}
                          disabled={checkoutMutation.isPending}
                          data-testid={`button-buy-${model}-${tier.price}`}
                        >
                          {checkoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `Buy $${(tier.price / 100).toFixed(0)}`
                          )}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
