---
title: "A founder-built AI platform, reviewed from the outside the month it took off"
summary: "Pindrop was signing people up faster than anyone could watch, and custom domains, the thing customers needed to go live, didn't work. The founder built all of it himself. I came in from outside, found what was wrong in a day, and then spent a session on where the product goes next."
client:
  name: "Pindrop"
  industry: "Software, AI website generation"
  location: "Pittsburgh, PA"
  website: "https://pindrop.host"
year: "2026"
work: "Advisory and launch review"
metric:
  value: "1 day"
  label: "to find and fix why every custom domain failed"
cover: "../../assets/case-studies/pindrop/pindrop-cover-blue.webp"
coverAlt: "The Pindrop wordmark in cream on the platform's blue."
coverBg: "orange"
coverStyle: "art"
logo: "/images/clients/pindrop-on-light.png"
logoDark: "/images/clients/pindrop-on-dark.png"
services:
  - "Infrastructure diagnosis"
  - "Customer journey review"
  - "Product and UX direction"
  - "Positioning"
testimonialIds:
  - "pindrop-shawn-markosky-2026-08"
order: 7
hidden: true
---

## The client

Pindrop is a Pittsburgh platform, founded by Shawn Markosky, that builds websites for local businesses. It shows businesses on a map, green if they have a website and gold if they don't. Tap a gold one and it pulls their Google listing and builds them a website in about six seconds, and then you edit it, publish it, and charge the owner without leaving the app. Behind that sit thirty million business records and automatic payment splitting between the seller and the platform.

Shawn built all of it himself with AI, and he isn't a developer. Three weeks after launch it had real traction, all of it from him posting videos. I didn't build Pindrop and I didn't write its code. My job was to walk the whole thing from the outside and say what was actually wrong.

## The problem

Custom domains were broken. Someone would build a site for a diner, the owner would want it on their own domain, and it wouldn't work. The dashboard said the domains were active and the certificates were issuing, and every one still failed.

Underneath that was the problem Shawn named himself: he couldn't detach himself from the product enough to see what a new person sees. He could build almost anything in an afternoon, but nobody had walked the whole thing front to back as a stranger, and nothing was ranking his list of around thirty open items.

## What I saw

**Why the domains failed.** It looked like a certificate problem and it was a routing problem. The platform's code only ran on addresses ending in Pindrop's own domain, so a customer's domain never reached it, and the green Active badge was telling the truth about the certificate and nothing about whether the site worked. We tested the fix against a domain of mine and against a real customer whose DNS wasn't on Cloudflare, and both worked. That customer had been broken since the day they signed up.

**A limit nobody knew was there.** Every published site was creating its own DNS record, and the account was about two thirds of the way to a hard cap. Hitting it would have stopped publishing for every user in the middle of his biggest week. A single wildcard record replaced them all and removed the limit without upgrading the plan, and we proved it on one live site before deleting anything.

**Instructions that matched the customer's screen.** Most connected domains were stuck because every customer got the same setup instructions, and those instructions only work at some DNS providers. I mapped which providers can do what, Shawn built detection that gives each customer instructions in their own provider's terms, and it went out the same night. That first day produced eleven deploys, and Shawn pushed every one of them.

**Where the product goes.** Three days later I spent three hours going through Pindrop as a new user would, from the ad link through signup, the trial, checkout, the builder, the editor, and the mobile app. The first question was who is actually buying, and the answer is mostly people making money on the side by selling sites to local businesses, not developers, which changes how much the product should decide for them. The category leader had already tried a panel of editing toggles and replaced it with describing changes in plain language, so I recommended a prompt-driven path alongside the templates, with hard guardrails so users don't blame Pindrop for odd output. Walking signup and checkout cold also surfaced a handful of fixes that are invisible from the inside. On defensibility, the builder on its own isn't the moat, and the chain of finding the lead, building the site, selling it, hosting it, and splitting the payment is.

## What changed

Custom domains work, including for customers whose DNS isn't on Cloudflare, and the publishing limit that would have stopped every user is gone. Customers get setup instructions for their own provider. Shawn was building the prompt-driven path before I left the second session, with a clear read on who his buyers are and what makes the business hard to copy. The longest conversation of the day was about choosing, because building is no longer his bottleneck and deciding what to build is now the whole job. One thing stays open, and I wrote it up rather than burying it: a customer whose domain sits at a provider like GoDaddy can't use the bare domain without www, which is a limit of DNS itself, so for now the answer is a subdomain or forwarding at the registrar.
