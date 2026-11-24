# PHASE-BRIEF: Take-home page redesign

Status: **T0 (brief, docs only)** this PR; **T1 (shared sharing, internal)** Not started; **T2 (the page)** Not started, after the owner approves a mock-up. The mortgage overpayment and next pound slices were closed by the owner on 24 November 2026; their open checks are below under "Still with the owner". Finished briefs are in `docs/history/phase-brief-archive.md`.

## Docs rule

Close out every session with the tiered checklist in `CLAUDE.md` ("Session close-out checklist").

## Take-home page redesign

### Goal

Bring `#/c/optimiser` (take-home pay and the pension compare) into the look of the household budget (0.33.0) and the home page (0.35.0): icon tiles and colours per part, a headline first, a ring of where gross pay goes, compact grouped rows, and **Share** as an image, PDF, CSV or text. It is the first of the calculator redesigns, chosen because the budget, the next pound page and the home figure all read take-home scenarios. UI only: no engine, tax config, `inputsVersion`, storage key or saved scenario change; every input and result from 0.35.0 stays. The page still shows `VerifiedBadge`, refuses with the unverified values named, and calls nothing best (G13).

### Parts

- **T0, brief (docs only, this PR):** this brief and decisions TH1 to TH8 for the owner.
- **T1, shared sharing (internal, no visible change):** the budget's share dialog becomes its second user's shared component, as `CLAUDE.md` asks (extract once two pages need it). `src/components/share/`: the dialog (formats, amounts toggle, print page, downloads), the canvas card drawn from a page-neutral model (title, when, headline, sentence, stats, coloured parts, footer), the CSV formula guard and `plainPounds`, the file name. What a budget says stays in `src/calculators/budget/share/summary.ts`, now building that model. The budget's text, CSV and card come out the same (its tests unchanged, plus one that the card draws the same model). Patch version, an "Internal only" changelog line.
- **T2, the page (after the mock-up is approved):** see "The page" below. Browser matrix and axe once, at 360 and 1280 px, light and dark. Help topic and `docs/ui-patterns.md` updated. Minor version.

### The page (T2, as proposed)

- **Your pay** stays visible at the top; each section (Pension, Pension allowances, Benefits and deductions, Student loans, Child Benefit, Tax code) gets an `IconTile` beside its title, as the budget's groups do. Live summaries, open-when-set and the item cards (U1 to U3, U9) are unchanged.
- **Headline first:** take-home for the chosen period, large, with the other periods under it, and the two payslip lines with a tax code (U8). The phone sticky bar (U4) stays as it is.
- **Where your gross pay goes:** the shared `Donut` in place of the `SplitBar` on this page (TH1), each part with its colour and icon, and its share of gross pay beside it; the table fallback stays. A take-home below nothing keeps today's "can't be drawn" path with the summary and table.
- **Breakdown** as compact rows in the same colours and icons (gross, each deduction, take-home), the Year / Month choice unchanged; the PAYE card and "Alongside your pay" restyled, not changed.
- **Pension compare** (1b-iii): visual alignment only (icon tiles on its sections, the same card styles); the picker, chart, milestones and warnings behave as now.
- **Share** beside the scenario bar, hidden on a refusal or invalid inputs: the image card (headline, ring, the parts), PDF (print), CSV of the breakdown, and text; an **amounts** toggle (off: every part as a share of gross pay, no £ figure anywhere, TH4). No names toggle (no user-named lines are shared, TH5). Made on the device; nothing uploaded; no storage key.

### Decisions for the owner (proposed)

- **TH1.** The ring (`Donut`) replaces the split bar on the take-home page only; the split bar stays a shared component (the car and next pound pages use it).
- **TH2.** Colours for the parts of pay: new semantic tokens `--sy-pay-tax`, `-ni`, `-student-loan`, `-pension`, `-hicbc`, `-benefits`, `-deductions`, mapped to existing palette steps (no new raw colours), with take-home in the budget's neutral left-over colour. The alternative is reusing the budget's group tokens (pension as saving green, and so on), which ties two meanings to one colour. A new token is a design-rule flag either way.
- **TH3.** Icons from Lucide, already a dependency: income tax `Landmark` (also the budget's savings pot, on another page), National Insurance `ShieldCheck`, student loan `GraduationCap`, pension `PiggyBank`, Child Benefit charge `Baby`, benefits `Gift`, deductions `Receipt`, take-home `Wallet`. Colour is never the only cue: each is named beside it.
- **TH4.** Share defaults to amounts **on**, as the budget does. Salary is the most sensitive figure here, so the alternative is off by default. Owner's call.
- **TH5.** What is shared: the headline, the ring and the breakdown for the chosen period, the tax year and region, and the footer. Not shared: benefit and deduction item names, the tax code, the pension compare.
- **TH6.** No what-if sliders on this page: the pension compare already is the what-if for the one input people change most.
- **TH7.** A mock-up (phone and laptop, light and dark) for the owner's approval at the start of T2, as for the home page.
- **TH8.** No change to the home card's figure (`homeFigure`, take-home a month).

### Out of scope

Engine, tax config, inputs and storage changes; a per-pay-period payroll view, choosing a contribution by tapping the chart, and the other backlog items for this page (`docs/backlog.md`); the other calculators' redesigns (mortgage, compound interest, next pound, car), each its own slice later.

### Edge cases to test (T1, T2)

| Case | Expect |
|---|---|
| Budget share after T1 | Text, CSV and card model identical to 0.35.0 for the budget's fixtures |
| Ring parts | Add up to gross pay for the chosen period; shares of gross from exact Ratios; no part drawn at nothing |
| Take-home below nothing | No ring; summary and table say why, as today's split bar does |
| Refusal or invalid inputs | No Share button; the refusal names the unverified values |
| Share with amounts off | No £ figure in the text, CSV, card or print page; percentages of gross only |
| CSV | Formula cells written as text; pounds from whole pence |
| With a tax code | Both payslip lines in the headline; the shared copy says which take-home it shows |
| Scottish region, a Child Benefit charge, salary sacrifice benefits | Each part appears with its own colour and label, in the ring, rows and share |
| Period | Year and Month give the same ring proportions within rounding; the sticky bar and breakdown share one choice (U4) |

## Still with the owner (follow-ups; none blocks the current part)

Carried to the next pound redesign (the owner closed the slice on 24 November 2026 and will revisit these in its redesign phase):

Next pound decision (C0): confirm the readings proposed under CP1 to CP9 (`docs/open-questions.md`, "Next pound decision"), in particular CP3's correction (net cost per £1 is measured from no contribution), CP5's ERC and freed payments, CP4's pension growth, lump sum allowance and default rate, CP7's break-even against the pension, and CP9's second exception (car ownership on car finance); spot-check the two leaves that rest on current guides naming no tax year (`pension.lumpSum.taxFreeShare`, `pension.minimumAge.current`; NP-2, NP-3, decided 23 October 2026, CP11) against the guides cited in `docs/verification-log.md`.

Next pound composer (C1): confirm the mortgage leg read at month 12 × years + 1 (CP1 as built), the starting growth rates in `src/lib/inputLimits.ts`, the £10 finer scan, the NP-1 warning's condition, and the refusal split (composer leaves refuse the whole result, an engine refuses its leg) (`docs/open-questions.md`, "Next pound composer (C1)"); fill `docs/next-pound-cross-checks.json`.

Next pound page (C2, C2.1): confirm the page readings (`docs/open-questions.md`, "Next pound page readings (C2)" and "(C2.1)"), in particular the headline wording for a leg with no number, the badge colour (no success token exists) and the manual reference's fee (its figures match a 0.5% fee, not none); decide on a worker for the composer (past 200 ms at 4x slowdown with a charge, `docs/performance.md`); check the page on a real phone, in Safari and with a screen reader.

Mortgage overpayment (closed by the owner on 24 November 2026; these stay as follow-ups, as for slices 1 to 3):

Mortgage overpayment (M2): confirm MO16 and the M2 page readings (`docs/open-questions.md`); fill `docs/mortgage-cross-checks.json` from a statement or illustration (settles MR-1, MR-2 and MR-4); check the page on a real phone, in Safari and with a screen reader.


Household budget (0.25.0): confirm BD8 (savings rate excludes what is left over), BD9 (`MAX_BUDGET_LINES` = 40 per list), the template lines' periods (Fixed saver monthly), the shared `Field` label now wrapping anywhere.

Confirm the benefit value from an annual statement (B1) and run the payslip check (B15: PAYE estimate, salary sacrifice benefits, the monthly breakdown); the 72 HMRC cross-checks; Tables A and B to D for the PAYE estimate (O10, O11); confirm `paye.codeUnit` as a standing rule; whether a benefit that attracts Class 1 needs its own input. Slice 2: fill `docs/compound-cross-checks.json` (eight cases, with source and date); confirm the C8 rate bounds and the starting years (`DEFAULT_PROJECTION_YEARS`).

Slice 3a: confirm decisions F5 to F14 and the bounds (`src/calculators/car-finance/README.md`); confirm F15 (one decimal place, the drawdown, an added fee as a charge) and settle CR-10 (a PCP's optional final payment, purchase and option fees in the APR) from a source before any page shows an APR for PCP or HP with an option fee; decide whether the hand-back path should also take condition charges. Slice 3b: confirm F24 to F31 (`src/calculators/car-ownership/README.md`); F18's two readings and the bounds were confirmed at the start of 3c-1; confirm litres per gallon from legislation.gov.uk (CO-1). Slice 3c-1: fill `docs/car-cross-checks.json` (six cases: a spreadsheet, or a real dealer quote for the payment; source and date) and `docs/compound-cross-checks.json`; spot-check the litres per gallon line in a fuel cost per mile; confirm the page decisions F32 to F37 (`DEFAULT_HORIZON_MONTHS` = 48 accepted at the start of 3c-2); check the page on a real phone. Slice 3c-2: confirm the page decisions F38 to F42 (optional boxes read as nothing, the chart, the selected month, the sensitivity's shifts, any pair); whether to move the flip search and the sensitivity to a worker (one flip search is a 250 to 430 ms task after the inputs settle, `docs/performance.md`); check the chart and its selection on a real phone and with a screen reader.

Car results redesign (3d-1): confirm U29 to U33, the verdict's wording and the per-month gap (the total difference over the horizon, rounded once); confirm U34 to U36 (OQ-flip-tie was closed in 3d-2, F53; the monthly penny drift was accepted as it is in 3e, F52); check the page on a real phone and with a screen reader.

Finance on a kept car (3e): confirm F43 to F52 as built (the refusal of a final payment above the settlement and of no payments left even with no monthly payment, F50; the implied rate through `hirePurchase`, F45); check the page against a real lender statement and settlement quote; on a real phone and with a screen reader.

Thresholds and the cost bridge (3d-2): confirm F53 to F56 as built (the band said as "about", level or pennies apart; equity handed back as a bridge part; "Most of the difference" only past half and on the total's side; the bridge in pence whatever Settings shows; the bridge's own Selects sharing the pair); check the bridge on a real phone and with a screen reader.

Compare redesign (1b-iii): confirm U24's maximum (the engine's, pay-bounded) and U25's chart measure (net cost per pound, an average from no contribution); check the page on a real phone, with Safari and with a screen reader.

## Last session

- 24 November 2026 (docs only): the owner closed the mortgage overpayment and next pound slices (Done in `PLAN.md`; the next pound brief moved to `docs/history/phase-brief-archive.md`; their open checks kept as follow-ups above) and chose the take-home page as the first calculator redesign. This brief, with TH1 to TH8 proposed.
- Before that: 0.35.0 (PR #189) the home page redesign; 0.34.0 and 0.33.0 the budget redesign. Not done for any: Safari, a real phone, a screen reader.

## Next

- Owner: answer TH1 to TH8 ("as proposed" or a change to each).
- T1: shared sharing in `src/components/share/`, the budget unchanged. Then the T2 mock-up for approval, then the page.

Full history (progress logs, finished part scopes, slice archives): `docs/history/` (grep it, don't read it whole).
