// A second copy of the operator prices, on purpose (Mark, November 6, 2026): the same numbers live in
// the markszymanski.co repo at src/lib/pricing.ts. Change both in the same task until the operator
// offers leave markszymanski.co, then this becomes the only copy.
export const pricing = {
  onboardingDay: {
    rate: 3500,
  },
  build: {
    rate: 15000,
  },
  care: {
    small: 500,
    team: 2000,
  },
  website: {
    care: 99,
  },
  fractional: {
    monthly: "8,000",
    earlyMonthly: "4,000",
    earlySpots: 2,
    totalSpots: 6,
    // Past this many people the monthly is quoted on the call (Mark, November 19, 2026): more people is more to build and train.
    teamSize: 50,
    // The $4,000 early rate was retired November 6, 2026 (Mark: flat $6,000). At 0 every early-rate line is hidden.
    earlySpotsLeft: 0,
  },
} as const;

export const usd = (n: number | string) => `$${Number(String(n).replace(/,/g, "")).toLocaleString("en-US")}`;
