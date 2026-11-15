import { pricing, usd } from "./pricing";

const p = pricing.fractional;
export interface Offer {
  id: string;
  name: string;
  short: string;
  price: string;
  priceNote?: string;
  forWho: string;
  includes: string[];
  starts: string;
  cta: { label: string; href: string };
  page: string;
  featured?: boolean;
}

export const offers: Offer[] = [
  {
    id: "fractional",
    name: "Fractional AI & Systems Lead",
    short: "I run your website, your systems, and your AI, and every month I work on more revenue or a more organized team.",
    price: `${usd(p.monthly)}/month`,
    priceNote: p.earlySpotsLeft > 0
      ? `${usd(p.earlyMonthly)}/month for my next ${p.earlySpotsLeft === 1 ? "client" : `${p.earlySpotsLeft} clients`}. Three-month minimum.`
      : "Three-month minimum, then month to month.",
    forWho: "Established firms with staff, where the owner wants one person accountable for the website, the systems, and the AI.",
    includes: [
      "Your website, hosted and kept running",
      "Custom tools and automations built as the business needs them",
      "Your AI set up around how the company actually works",
      "One number I set at kickoff to prove it's working, measured every month",
    ],
    starts: "A 20-minute intro call. If it's a fit, kickoff is where I learn the business and tell you what I'd fix first and why.",
    cta: { label: "See How It Works", href: "/fractional" },
    page: "/fractional",
    featured: true,
  },
  {
    id: "ai-onboarding-day",
    name: "AI Onboarding Day",
    short: "One day and your AI actually knows your business: your context written down, your tools connected, and you and your team trained to use it.",
    price: `${usd(pricing.onboardingDay.rate)}, one day`,
    priceNote: "Paid up front.",
    forWho: "Owners already using ChatGPT or Claude who know it could be doing a lot more and would rather have it set up right than figure it out alone.",
    includes: [
      "An interview about how the business really works",
      "That knowledge written down where your AI can use it",
      "Your AI connected to the tools you already use",
      "Training for you and anyone on the team who joins",
    ],
    starts: "Paid up front, scheduled as one day. It stands on its own, and it's the natural first step toward having me on every month.",
    cta: { label: "See How It Works", href: "/ai-onboarding-day" },
    page: "/ai-onboarding-day",
  },
];
