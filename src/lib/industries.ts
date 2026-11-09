/**
 * The industry versions of /fractional (/fractional/<slug>). Same offer, price, spots, and
 * terms as the general page; only the wording and the proof order change. Rendered by
 * src/components/fractional/FractionalPage.astro via src/pages/fractional/[industry].astro.
 * Copied from the markszymanski.co repo's src/lib/industries.ts (its /work-with-me pages), November
 * 6, 2026; the two copies are not synced, so a wording change goes in both until one page retires.
 * storyOrder holds case study slugs, which match markszymanski.co's success story slugs.
 *
 * Proof rule (Mark, October 28, 2026): only claim work actually done. One law firm is one law firm,
 * and the FAQ says so. Testimonial excerpts must be verbatim trims of the published quote.
 */

export type Industry = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1Setup: string;
  intro: string;
  audience: string;
  leadsBody: string;
  leadsMeasures: string[];
  organizedBody: string;
  organizedMeasures: string[];
  win: string;
  winNoun: string;
  storyOrder: string[];
  heroQuoteId: string;
  heroQuoteExcerpt?: string;
  midQuoteId?: string;
  midQuoteExcerpt?: string;
  industryFaq: { q: string; a: string };
  formTag: string;
};

export const industries: Industry[] = [
  {
    slug: "engineering-firms",
    metaTitle: "Fractional AI and Systems Lead: Engineering and Surveying Firms - Motive11",
    metaDescription:
      "For engineering and surveying firms: one person to run your proposals, your website, and your systems, without the full-time hire.",
    eyebrow: "For engineering and surveying firms",
    h1Setup: "The person who runs your firm's proposals, website, and systems,",
    intro:
      "Your engineers should be engineering, not digging through old proposals and county websites to quote the next job. I build the software that takes that off their plate, keep it running, and improve it every month.",
    audience:
      "This is for established firms with a team, where quoting, site research, and paperwork eat the hours your people should be billing. One person, one monthly fee, working on whatever moves your firm most.",
    leadsBody:
      "I look at how your firm brings in revenue: how many of the right clients find you, how many ask for a quote, how many proposals you win, and how much repeat work your current clients send. Then I fix the step that's leaking the most.",
    leadsMeasures: ["Quote requests/month", "Projects won/month", "Repeat and referral projects"],
    organizedBody:
      "Less of your team's week spent on proposals, site research, and paperwork. Proposals drafted from your own past work, research pulled from county and state sources in one step, and intake that files itself.",
    organizedMeasures: ["How long a proposal takes", "Hours/week spent on site research", "Proposals out without adding staff"],
    win: "won project",
    winNoun: "project",
    storyOrder: ["sheffler-and-company"],
    heroQuoteId: "8b67a481-a547-4d8f-a6e1-c4554bb6f0fe",
    heroQuoteExcerpt:
      "When my team finds something that needs to change, Mark fixes it fast, often the same day. At this point he knows how our business runs as well as anyone in the building.",
    midQuoteId: "a85e6793-5b63-4dc5-99d5-f6c18eadd6d6",
    industryFaq: {
      q: "Have you worked with engineering firms?",
      a: "Yes. Sheffler & Company, a civil engineering and surveying firm, writes its proposals in software I built from 1,568 of their own past proposals, and a routine survey proposal now takes about half the time it used to. The full story is on this page. Every firm prices and scopes its work differently, which is why kickoff starts with how yours does it.",
    },
    formTag: "Engineering firms page",
  },
  {
    slug: "law-firms",
    metaTitle: "Fractional AI and Systems Lead: Law Firms - Motive11",
    metaDescription:
      "For law firms: one person to run your intake, your website, and your systems, without the full-time hire.",
    eyebrow: "For law firms",
    h1Setup: "The person who runs your firm's intake, website, and systems,",
    intro:
      "Every new case starts as a phone call or a form. I make sure none of them slip through, take the paperwork off your staff's plate, keep it all running, and improve it every month.",
    audience:
      "This is for established firms with staff, where intake, follow-up, and document work eat the hours that should go to clients. One person, one monthly fee, working on whatever moves your firm most.",
    leadsBody:
      "I look at how your firm brings in revenue: how many of the right clients find you, how many call or fill out your form, how many sign, and how many referrals your past clients send. Then I fix the step that's leaking the most.",
    leadsMeasures: ["New case inquiries/month", "Signed cases/month", "Referral cases/month"],
    organizedBody:
      "Less of your staff's week spent on work software should be doing. Intake, document filing, client updates, and the same emails written again and again, built around how your firm already works.",
    organizedMeasures: ["Hours/week your staff spends on intake and filing", "How long it takes to open a new matter", "Cases handled without adding staff"],
    win: "signed case",
    winNoun: "case",
    storyOrder: ["polverini-and-wiater", "sheffler-and-company"],
    heroQuoteId: "4c048fec-ef75-471c-9e21-b9f7a4374d0f",
    heroQuoteExcerpt:
      "He has been a steady presence since launch, managing the site, pushing updates, and giving me his honest read whenever I ask him about next steps. That's exactly what I need.",
    industryFaq: {
      q: "Have you worked with law firms?",
      a: "Yes. I built Polverini & Wiater's website when the firm launched under its new name, and I've run it since. That's one firm, not fifty, and I'd rather tell you that than pretend otherwise. What carries over is the work itself: intake that never drops anyone, paperwork that files itself, and a site that brings in the cases you want. Kickoff is where I learn how your firm runs.",
    },
    formTag: "Law firms page",
  },
  {
    slug: "home-services",
    metaTitle: "Fractional AI and Systems Lead: Contractors and Home Service Companies - Motive11",
    metaDescription:
      "For contractors and home service companies: one person to run your website, your leads, and your office systems, without the full-time hire.",
    eyebrow: "For contractors and home service companies",
    h1Setup: "The person who runs your website, your leads, and your office systems,",
    intro:
      "You're on a job site when the next lead comes in. I make sure every one gets answered, take the paperwork off your office, keep it all running, and improve it every month.",
    audience:
      "This is for established companies with office staff or crews, where the owner can't answer every call and run every job. One person, one monthly fee, working on whatever moves your business most.",
    leadsBody:
      "I look at how your business brings in revenue: how many of the right customers find you, how many ask for an estimate, how many sign, and how much repeat and referral work comes back. Then I fix the step that's leaking the most.",
    leadsMeasures: ["Estimate requests/month", "Jobs signed/month", "Repeat and referral jobs"],
    organizedBody:
      "Less of your office's week spent on estimates, scheduling, and chasing paperwork. Tools your team uses every day, built around how you already run jobs.",
    organizedMeasures: ["How long an estimate takes", "Hours/week on scheduling and follow-up", "Jobs handled without adding office staff"],
    win: "signed job",
    winNoun: "job",
    storyOrder: ["quality-choice-landscaping", "valor-pgh"],
    heroQuoteId: "77660a59-447d-4c96-aff1-43db6edfe326",
    heroQuoteExcerpt:
      "I came to Mark thinking I needed a new website. That's what I asked for. What I ended up getting was somebody who actually took the time to learn my business and came back with ideas I hadn't thought of.",
    midQuoteId: "dc34f778-03de-44a7-9b0c-a1f9720899c4",
    midQuoteExcerpt:
      "If you are a small business owner looking for someone who actually thinks about your business and not just the thing you hired him for, talk to Mark.",
    industryFaq: {
      q: "Have you worked with contractors?",
      a: "Yes. Quality Choice Landscaping, from their first real website through their move into hardscaping and design-build, plus a roofing company and a renovation business. The trades differ, but the problems repeat: estimate requests that sit, a website that doesn't show the work you want more of, and an office buried in scheduling. Kickoff is where I learn how your jobs run.",
    },
    formTag: "Home services page",
  },
];
