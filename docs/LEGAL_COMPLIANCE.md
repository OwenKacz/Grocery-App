---
title: grocery-app — Legal & Regulatory Compliance Memorandum
created: 2026-06-08
updated: 2026-06-08
status: draft for legal review
jurisdiction: Ontario, Canada (primary); US / Quebec / EU flagged for expansion
prepared_for: External legal counsel review
tags:
  - project/grocery-app
  - legal
  - compliance
  - risk
---

# grocery-app — Legal & Regulatory Compliance Memorandum

**Document status:** Draft for review by qualified legal counsel
**Prepared:** 2026-06-08
**Primary jurisdiction:** Province of Ontario, Canada
**Currency / market:** Canadian Dollar (CAD); Ontario consumers first

---

> [!warning] Important — read first
> This memorandum was prepared by the project's development team to **organize and disclose** the app's design, data practices, and commercial model so that **qualified legal counsel can review them**. It is **not legal advice** and does not create a solicitor–client relationship. Statutory references are provided for the reviewer's convenience and may be incomplete or superseded. Nothing here should be relied upon as a legal opinion. Where this document states a "current posture," it describes the team's good-faith intent, not a determination of legality.

---

## 1. Purpose & how to use this document

This memorandum is intended to let a reviewing lawyer:

1. Understand **what the product does**, technically and commercially (Sections 2–3).
2. Review each **risk area** in a consistent format — applicable law, current posture/mitigation, and **open questions for counsel** (Sections 5–17).
3. Use the **consolidated risk matrix** (Section 18) and **question list** (Section 19) as a worksheet.

The guiding principle of the build has been: **do nothing that depends on data or access we are not clearly permitted to use.** The architecture (Section 3) is deliberately designed so the product can operate entirely on lawfully obtained data (licensed feeds, retailer-permissioned APIs, manual entry, or user contributions) and so that no individual retailer integration is hard-coded or assumed.

---

## 2. Product & business model

**What it is.** A mobile-responsive web application (installable as a Progressive Web App) that helps consumers find the lowest prices on grocery items at stores near them — colloquially, "GasBuddy for groceries."

**Core user flow.**
1. The user provides a location (postal code or device geolocation, with consent).
2. The user searches for an item or pastes a grocery list.
3. The app returns matching products at nearby stores, sorted cheapest-to-most-expensive, showing store, distance, brand, package size, unit price, regular price, sale price, and a **"last updated" timestamp**.
4. For a full list: cheapest option per item, an optional "cheapest single-store basket," and an estimated total.

**Business model.**
- **Subscription:** CAD $5.99/month, recurring.
- **Free tier:** a limited number of searches per month (configurable; default 5) before an upgrade prompt.
- Payments processed by **Stripe** (the app does not handle or store card data directly).

**Important design choice — data is cached, not scraped live.** The app's search reads from **our own database of prices**, which is populated by a scheduled ingestion process from whatever data sources are lawfully connected. The app does **not** query retailer websites in real time in response to user searches.

---

## 3. Technical architecture relevant to legal review

| Layer | Implementation | Legal relevance |
|---|---|---|
| Frontend / app | Next.js (React) web app + PWA, hosted on Vercel (target) | Consumer-facing claims, accessibility, terms/consent UX |
| Database & auth | Supabase (PostgreSQL) with Row-Level Security; hosted in **US (us-east-1)** | Personal data storage; **cross-border data transfer**; security controls |
| Payments | Stripe (Checkout, Customer Portal, webhooks) | PCI-DSS scope, subscription/auto-renewal law, tax |
| Geocoding / maps | Pluggable module; **mock by default**; Google or Mapbox optional later | Map-provider terms of service; location-data consent |
| **Data-source layer** | Pluggable `DataSourceAdapter` interface with 4 adapter types: **REST API**, **third-party vendor (licensed data)**, **CSV / flyer import**, **manual entry**. A registry lists active sources. | **Central IP / contract / scraping risk.** See Section 6. |

**Key control:** the data-source layer is the single point through which all pricing data enters the system. No retailer is hard-coded elsewhere in the app. This makes it possible to (a) restrict the system to permitted sources, (b) record the provenance and legal basis of each source, and (c) disable any source instantly.

---

## 4. Compliance methodology

- **Data minimization:** collect only what the feature requires.
- **Provenance tracking:** each data source is a configured record (adapter type + configuration) so its legal basis can be documented per source.
- **Secrets hygiene:** credentials/API keys are stored server-side only (never shipped to the browser, never committed to source control); the public code repository contains only an example environment file.
- **Security by default:** Row-Level Security on every database table; a privileged "secret" key is used only by server-side jobs and never exposed.
- **Transparency to users:** prices display a "last updated" timestamp and accuracy disclaimers (planned, see Section 8).

---

## 5. How to read the risk entries

Each area below uses this format:

- **Applicable law / framework** — the principal statutes or rules a reviewer should consider.
- **Current posture / mitigation** — what the build does today or plans to do.
- **Residual risk** — Low / Medium / High (the team's preliminary, non-legal estimate).
- **Open questions for counsel** — what we want the lawyer to confirm or advise on.

---

## 6. Data sourcing, scraping, IP & database rights — *central risk*

**Why this is the headline issue.** Most Canadian grocery chains do not publish a public price API and their website terms generally prohibit automated collection ("scraping"). Acquiring accurate, current price data **lawfully** is the principal legal and operational challenge of this product. This is a data-rights and contract problem, not a coding problem.

**Applicable law / framework (Canada):**
- **Copyright Act (Canada).** Individual facts (e.g., a price) are not protected, but **compilations** and the **expressive content** of listings (product descriptions, photographs, formatted flyers) can attract copyright. Reproducing retailer text or images may infringe.
- **Breach of contract.** Website/app **Terms of Service** that prohibit scraping or automated access are contractual; violating them can ground a breach-of-contract claim even where copyright does not apply.
- **Criminal Code (Canada) s. 342.1** (unauthorized use of a computer) and **s. 430(1.1)** (mischief in relation to computer data) — potentially engaged where access circumvents technical controls or rate limits.
- **Trespass to chattels / unjust enrichment** — civil theories sometimes pleaded against scrapers.
- **Tort of passing off** and **Competition Act** misrepresentation if data presentation implies a relationship or misstates a retailer's prices.

**Current posture / mitigation:**
- **No live scraping in the request path.** Search reads our cached database.
- **Adapter model restricts inputs to four lawful channels:**
  1. **Licensed third-party data vendors** (paid feeds with contractual rights to redistribute).
  2. **Retailer-permissioned REST APIs / affiliate or partner feeds** (used only where the retailer grants access).
  3. **CSV / flyer import** (e.g., publicly distributed flyer data the team has rights to use, or data provided by a partner).
  4. **Manual entry** (prices entered by staff or, potentially, contributed by users — see crowdsourcing below).
- **Provenance is recorded per source**, enabling per-source legal sign-off and instant deactivation.
- The team's stated rule: **do not connect any retailer source without a documented legal basis** (license, written permission, or a lawful public channel confirmed by counsel).

**Crowdsourcing option (under consideration):** user-submitted prices (like fuel-price apps) shift the model toward user-generated content. This introduces different risks (accuracy, liability for user submissions, moderation, potential inducement to breach store rules) and benefits (no retailer data dependency). **Flagged for counsel.**

**Residual risk:** **High** until each intended data source is individually cleared by counsel.

**Open questions for counsel:**
1. For each candidate data source, is our intended access and redistribution lawful (copyright, ToS, and Criminal Code considerations)?
2. Is a **crowdsourced** price model viable in Canada, and what moderation/attribution/disclaimer regime is required?
3. To what extent may we reproduce **product names, descriptions, package sizes, and images** versus only **facts** (price, store, date)?
4. What contractual terms should we require from any licensed data vendor (warranties of right-to-use, indemnity)?
5. Does displaying a retailer's prices without permission create **passing-off** or **Competition Act** exposure even if the underlying facts are lawfully obtained?

---

## 7. Trademark & brand use

**Issue.** The app necessarily names retailers (e.g., store names) and may wish to show logos to help users identify stores.

**Applicable law / framework:**
- **Trademarks Act (Canada).** Use of another's trademark to identify their goods/store may be permissible **nominative/descriptive** use, but:
  - **s. 22 (depreciation of goodwill)** — Canada uniquely allows a claim for use of a registered trademark that depreciates its goodwill, even without confusion (*Clairol*, *Veuve Clicquot*). Comparative use can be sensitive here.
  - **s. 7 / passing off** — must not imply false affiliation, endorsement, or sponsorship.
- **Logos** are additionally protected by **copyright**.

**Current posture / mitigation:**
- Use store **names** descriptively, only to identify where a price applies.
- **Avoid displaying retailer logos** unless licensed; prefer neutral text/icons.
- Include a clear **disclaimer of non-affiliation** ("not affiliated with, endorsed by, or sponsored by any retailer").
- Choose an app name and branding that does not incorporate or imply a retailer's brand.

**Residual risk:** **Medium** (lower if logos are avoided and disclaimers are clear).

**Open questions for counsel:**
1. Is nominative use of store names for comparative pricing safe under **s. 22**?
2. May we display logos at all, and if so under what conditions?
3. Is our app name/branding free of trademark conflict?

---

## 8. Consumer protection, pricing accuracy & advertising law — *app interface*

**Issue.** The product's core value is **price information** that consumers may rely on. Inaccurate, stale, or misleadingly presented prices create consumer-protection and misrepresentation exposure.

**Applicable law / framework:**
- **Competition Act (Canada):**
  - **s. 52 / s. 74.01** — false or misleading representations to the public.
  - **Ordinary selling price** rules for any "regular vs. sale" comparison we display.
  - **Drip pricing** provisions (recent amendments) — advertised prices must be attainable; mandatory fixed fees must be included. Relevant if we ever display totals/estimates.
- **Ontario Consumer Protection Act** (the **Consumer Protection Act, 2002**, and the modernized **Consumer Protection Act, 2023** and its regulations) — unfair practices, representations, and rules for **online/remote agreements** and **automatic renewals** (see Section 9).
- **Civil misrepresentation / negligent misstatement** — if users suffer loss relying on wrong prices.

**Current posture / mitigation:**
- Every price shows a **"last updated" timestamp**.
- Planned **accuracy disclaimer**: prices are **estimates for comparison**, may change, and should be **verified in-store**; we do not guarantee accuracy or availability.
- We present **our own observed/ingested data with its date**, rather than asserting a retailer's *current* price as fact.
- A mechanism to **flag/correct** inaccurate prices (planned).
- If we show "regular vs. sale," we will follow ordinary-price substantiation rules or avoid the comparison.

**Residual risk:** **Medium.**

**Open questions for counsel:**
1. What disclaimer language adequately limits reliance/misrepresentation exposure?
2. If we display a "sale vs. regular" price from a retailer, what substantiation do we need?
3. Do our **basket totals/estimates** trigger drip-pricing or total-price rules?
4. Any Ontario CPA 2023 requirements specific to our online subscription and information service?

---

## 9. Payments, subscriptions & financial compliance — *finance*

**Issue.** Recurring billing, auto-renewal, taxes, refunds, and cardholder-data handling.

**Applicable law / framework:**
- **PCI-DSS** — satisfied by using **Stripe-hosted** payment flows so card data never touches our servers (we must avoid handling PAN data to stay out of scope).
- **Auto-renewal / negative-option billing:** **Competition Act** and **Ontario CPA** rules on automatic renewals, clear disclosure of recurring charges, cancellation rights, and (for online agreements) disclosure + copy-of-agreement requirements. (Note: if expanding to the **US**, multiple state **automatic-renewal laws (ARL)** — e.g., California — impose specific consent/cancellation-UX rules.)
- **Tax:** **HST (13% in Ontario)** on the subscription; **GST/HST registration** required once revenue exceeds the **$30,000** small-supplier threshold (and advisable to plan for from launch). Tax treatment of digital services to consumers in other provinces differs.
- **Consumer disclosure:** clear price, billing frequency, currency (CAD), what's included in free vs. paid, and how to cancel.
- **AML:** low risk for low-value subscriptions; Stripe handles KYC on the merchant side.

**Current posture / mitigation:**
- Stripe Checkout + Customer Portal (self-serve cancellation) — keeps us out of direct PCI scope and gives users an easy cancel path.
- Webhooks will be **signature-verified** so subscription state changes are authenticated.
- Subscription status is changed only by server-side, privileged code (users cannot self-modify their subscription/role — enforced at the database layer).
- Planned: explicit **pre-purchase disclosure** of recurring terms, **email receipts**, and a written **refund policy**.

**Residual risk:** **Low–Medium** (mainly disclosure/tax setup and auto-renewal UX).

**Open questions for counsel:**
1. What exact **pre-checkout disclosures** and **cancellation UX** do Ontario CPA + Competition Act require for a recurring CAD subscription?
2. Confirm **HST registration/collection** timing and multi-province handling.
3. What **refund/cancellation policy** is compliant and advisable?
4. If we offer a **free trial**, what disclosures are required before conversion to paid?

---

## 10. Privacy & personal data — *backend*

**Issue.** We collect personal information: email/credentials, optional home location/postal code and precise geolocation, saved grocery lists, and search history.

**Applicable law / framework:**
- **PIPEDA** (federal private-sector privacy law; applies to commercial activity in Ontario, which has no general private-sector statute).
- **Cross-border transfer:** our database/host is in the **US**; PIPEDA requires **disclosure** that data may be stored/processed outside Canada and subject to foreign law.
- **Quebec Law 25** if we serve Quebec residents (stricter consent, privacy officer, impact assessments).
- **GDPR / UK GDPR** if we ever serve the EU/UK.
- **Location data** is sensitive and requires meaningful, specific consent.
- **Children:** if any users may be minors, additional restrictions apply; we should set a **minimum age** and not knowingly collect children's data.

**Current posture / mitigation:**
- **Data minimization** — location can be a postal code; precise geolocation only with explicit consent.
- **Row-Level Security** isolates each user's private data (lists, searches, profile) to that user; catalog data is public-read only.
- Privileged keys server-side only.
- Planned: a **Privacy Policy** (collection, purposes, retention, cross-border storage, access/deletion rights, contact), **consent prompts** for geolocation, and a **data retention schedule**.
- Planned: **account deletion** and **data access/correction** request handling.

**Residual risk:** **Medium** (until Privacy Policy + consent flows + retention + breach plan are finalized).

**Open questions for counsel:**
1. Does our Privacy Policy and consent model satisfy **PIPEDA**, including **cross-border** disclosure for US hosting?
2. What **retention periods** are appropriate for search history and location?
3. Should we host data **in Canada** to reduce risk, or is disclosure sufficient?
4. What is required if we expand to **Quebec (Law 25)** or the **EU (GDPR)**?
5. What **minimum age** and children's-data safeguards should we adopt?

---

## 11. Anti-spam / electronic messaging (CASL)

**Applicable law:** **Canada's Anti-Spam Legislation (CASL)** governs **commercial electronic messages** (marketing emails, push promos). Requires **consent** (express or implied), **sender identification**, and a functioning **unsubscribe** mechanism. Penalties are significant.

**Current posture / mitigation:** transactional messages (receipts, password resets, billing notices) are generally permitted; **marketing** messages will require **consent capture** and unsubscribe. Planned: separate marketing-consent checkbox (unchecked by default) and suppression-list handling.

**Residual risk:** **Low–Medium.**

**Open questions for counsel:** Confirm our consent capture, message footer, and unsubscribe satisfy CASL; advise on the transactional/marketing boundary.

---

## 12. Accessibility (AODA)

**Applicable law:** **Accessibility for Ontarians with Disabilities Act (AODA)** and its **Integrated Accessibility Standards Regulation**, which require conformance to **WCAG 2.0 Level AA** for public-facing web content of covered organizations (thresholds based on organization size/type; small private organizations have lighter obligations, but conformance is best practice and reduces discrimination risk).

**Current posture / mitigation:** building mobile-first, semantic, accessible UI; planned WCAG 2.0 AA review before launch.

**Residual risk:** **Low.**

**Open questions for counsel:** Confirm whether/when AODA web obligations apply to us as we grow, and the appropriate WCAG target.

---

## 13. Information security & breach response — *backend*

**Applicable law / framework:** PIPEDA **breach of security safeguards** obligations (record-keeping, and notification to the Privacy Commissioner and affected individuals where there is a **real risk of significant harm**).

**Current posture / mitigation:**
- Row-Level Security on all tables; least-privilege key usage; secrets never in client or source control.
- Authentication and session handling via Supabase Auth.
- Planned: documented **incident-response plan**, logging/audit, dependency-vulnerability monitoring, and a breach-notification procedure.

**Residual risk:** **Medium** (until IR plan and monitoring are formalized).

**Open questions for counsel:** Confirm our breach-assessment and notification procedures meet PIPEDA; advise on record-keeping obligations.

---

## 14. Terms of Service / EULA & policies the app needs

The following user-facing legal documents are **planned and recommended** before public launch:

1. **Terms of Service** — license to use, acceptable use, **disclaimer of warranties** (esp. price accuracy/availability), **limitation of liability**, account termination, **governing law (Ontario)** and dispute resolution.
2. **Privacy Policy** — see Section 10.
3. **Subscription/Billing Terms** — recurring charges, renewal, cancellation, refunds, taxes.
4. **Acceptable Use / Content Policy** — especially if user-contributed prices are enabled.
5. **Cookie/Tracking notice** — if analytics or non-essential cookies are used (consent as required).

**Open questions for counsel:** Draft/review all five; confirm enforceability of limitation-of-liability and the click-wrap acceptance mechanism in Ontario.

---

## 15. Map / geocoding provider terms

**Issue.** If we enable **Google Maps Platform** or **Mapbox**, their **terms of service** impose restrictions (e.g., Google generally requires its data be displayed on a Google map, restricts caching, and prohibits using its content to build or improve a **competing** dataset).

**Current posture / mitigation:** geocoding defaults to a **mock**; no third-party map provider is enabled by default. Any provider will be used strictly within its ToS.

**Residual risk:** **Low** (while mock); **Medium** if a provider is enabled without ToS review.

**Open questions for counsel:** Review the chosen provider's ToS for caching, storage, and competitive-use restrictions before enabling.

---

## 16. Open-source & third-party software licensing

**Issue.** The app depends on open-source packages (e.g., Next.js, React — typically MIT/permissive).

**Current posture / mitigation:** dependencies are mainstream permissive licenses; we will maintain a dependency/license inventory and comply with attribution requirements.

**Residual risk:** **Low.**

**Open questions for counsel:** Confirm no copyleft obligations conflict with our proprietary/commercial use.

---

## 17. Corporate structure, liability & insurance (business-level)

**Considerations (for the founder + counsel/accountant):**
- **Incorporation** (e.g., a Canadian corporation) to provide **limited liability** separating personal and business risk — advisable before taking revenue.
- **Business name registration** and **GST/HST registration** (Section 9).
- **Insurance:** **commercial general liability**, **errors & omissions / professional liability** (given reliance on our information), and **cyber/privacy-breach insurance**.
- **Contracts:** data-vendor agreements with **right-to-use warranties and indemnities**; contractor/IP-assignment agreements for any developers.

**Residual risk:** **Medium** (operational/financial exposure if unincorporated and uninsured).

**Open questions for counsel:** Recommend structure, registrations, and insurance coverage appropriate to the data-reliance risk profile.

---

## 18. Consolidated risk matrix

| # | Area | Principal legal basis | Residual risk | Gating before public launch? |
|---|---|---|---|---|
| 6 | **Data sourcing / scraping / IP** | Copyright Act; contract (ToS); Criminal Code s.342.1/430 | **High** | **Yes** — each source cleared by counsel |
| 7 | Trademark / brand use | Trademarks Act (incl. s.22) | Medium | Yes (esp. logos) |
| 8 | Pricing accuracy / advertising | Competition Act; Ontario CPA | Medium | Yes (disclaimers) |
| 9 | Payments / subscriptions / tax | Competition Act; Ontario CPA; HST | Low–Med | Yes (disclosures, tax) |
| 10 | Privacy / personal data | PIPEDA; (Law 25 / GDPR later) | Medium | Yes (policy + consent) |
| 11 | Anti-spam | CASL | Low–Med | If marketing emails |
| 12 | Accessibility | AODA / WCAG 2.0 AA | Low | Best practice |
| 13 | Security / breach response | PIPEDA safeguards | Medium | Yes (IR plan) |
| 14 | ToS / EULA / policies | Contract; consumer law | — | Yes (all five docs) |
| 15 | Map provider terms | Provider ToS | Low/Med | Only if enabled |
| 16 | Open-source licensing | License terms | Low | Inventory |
| 17 | Corporate / liability / insurance | Corporate & tax law | Medium | Advisable pre-revenue |

---

## 19. Consolidated list of questions for legal counsel

**Data & IP (highest priority)**
1. For each proposed data source, confirm lawful access and redistribution (copyright, ToS, Criminal Code).
2. Viability and required safeguards for a **crowdsourced** price model in Canada.
3. Permitted scope of reproducing product names/descriptions/images vs. facts only.
4. Required warranties/indemnities from licensed data vendors.

**Brand & advertising**
5. Nominative use of store names under Trademarks Act s. 22; logo use; app-name clearance.
6. Disclaimer language to limit price-accuracy reliance; sale-vs-regular substantiation; drip-pricing/total-price rules for baskets.

**Payments & consumer**
7. Ontario CPA + Competition Act auto-renewal disclosure and cancellation UX for a CAD subscription.
8. HST registration/collection and multi-province treatment; refund policy; free-trial disclosures.

**Privacy & security**
9. PIPEDA-compliant Privacy Policy incl. **US cross-border** disclosure; retention periods; whether to host in Canada.
10. Quebec **Law 25** / EU **GDPR** requirements upon expansion; minimum-age and children's-data approach.
11. PIPEDA breach-assessment/notification procedures and record-keeping.

**Governance & documents**
12. Draft/review **ToS, Privacy Policy, Billing Terms, Acceptable Use, Cookie notice**; enforceability of limitation-of-liability and click-wrap in Ontario.
13. CASL consent/unsubscribe compliance for any marketing.
14. AODA/WCAG applicability and target.
15. Map-provider ToS review before enabling Google/Mapbox.
16. Corporate structure, registrations, and insurance recommendations.

---

## 20. Appendix — current build state (for context)

- **Phase 1 (scaffold):** complete.
- **Phase 2 (database + security):** complete and applied — schema with Row-Level Security on all tables; privilege-escalation guard preventing users from altering their own role/subscription; data-source configuration table is admin-only (intended to hold credentials).
- **Phase 3 (data layer):** in progress — pluggable adapter interface and four adapter types built; ingestion runs server-side with a privileged key; no retailer source is connected and the app currently runs on **sample/seed data only**.
- **Not yet built:** search UI, user authentication, Stripe payments, admin panel, and all user-facing legal documents (Section 14).
- **No live retailer data is connected**, and none will be without a documented legal basis confirmed per Section 6.

*End of memorandum.*
