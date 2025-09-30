export const CREDIT_PRICING = {
  zhi1: {
    name: "ZHI 1 (OpenAI)",
    tiers: [
      { price: 500, credits: 4275000, label: "$5 → 4,275,000 words" },
      { price: 1000, credits: 8977500, label: "$10 → 8,977,500 words" },
      { price: 2500, credits: 23512500, label: "$25 → 23,512,500 words" },
      { price: 5000, credits: 51300000, label: "$50 → 51,300,000 words" },
      { price: 10000, credits: 115425000, label: "$100 → 115,425,000 words" },
    ],
  },
  zhi2: {
    name: "ZHI 2 (Anthropic)",
    tiers: [
      { price: 500, credits: 106840, label: "$5 → 106,840 words" },
      { price: 1000, credits: 224360, label: "$10 → 224,360 words" },
      { price: 2500, credits: 587625, label: "$25 → 587,625 words" },
      { price: 5000, credits: 1282100, label: "$50 → 1,282,100 words" },
      { price: 10000, credits: 2883400, label: "$100 → 2,883,400 words" },
    ],
  },
  zhi3: {
    name: "ZHI 3 (DeepSeek)",
    tiers: [
      { price: 500, credits: 702000, label: "$5 → 702,000 words" },
      { price: 1000, credits: 1474200, label: "$10 → 1,474,200 words" },
      { price: 2500, credits: 3861000, label: "$25 → 3,861,000 words" },
      { price: 5000, credits: 8424000, label: "$50 → 8,424,000 words" },
      { price: 10000, credits: 18954000, label: "$100 → 18,954,000 words" },
    ],
  },
  zhi4: {
    name: "ZHI 4 (Perplexity)",
    tiers: [
      { price: 500, credits: 6410255, label: "$5 → 6,410,255 words" },
      { price: 1000, credits: 13461530, label: "$10 → 13,461,530 words" },
      { price: 2500, credits: 35256400, label: "$25 → 35,256,400 words" },
      { price: 5000, credits: 76923050, label: "$50 → 76,923,050 words" },
      { price: 10000, credits: 173176900, label: "$100 → 173,176,900 words" },
    ],
  },
};

export type ZHIModel = keyof typeof CREDIT_PRICING;

export function getCreditsForPurchase(model: ZHIModel, priceInCents: number): number {
  const tier = CREDIT_PRICING[model].tiers.find((t) => t.price === priceInCents);
  return tier?.credits || 0;
}
