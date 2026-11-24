# PHASE-BRIEF: Car decision redesign

Status: **Car decision redesign** Done (0.38.0, PR #192), signed off and merged by the owner on 24 November 2026. The mortgage redesign (0.37.0, PR #191) is merged; its brief is in `docs/history/phase-brief-archive.md`. The mortgage overpayment and next pound slices were closed by the owner on 24 November 2026; their open checks are below under "Still with the owner".

## Docs rule

Close out every session with the tiered checklist in `CLAUDE.md` ("Session close-out checklist").

## Car decision redesign

### Goal

Bring `#/c/car-decision` in line with the budget (0.33.0), take-home (0.36.0) and mortgage (0.37.0) pages, and make it quicker to fill in and read: not only a new look but usability and features, as the budget's redesign was. The owner approved the proposal (CD1 to CD12) in chat on 24 November 2026, with the input changes in the same PR (0.38.0), sign-off from screenshots, and shares with amounts off as a percentage above the lowest. This replaces "car decision lightly" under Next. Every result stays the engines'; the page still calls nothing best (U29).

### Why (the 0.37.0 page, three options filled)

About 13,200 px tall on a laptop and 18,900 px on a phone: every option's editor open in full with long hints; the results split between the verdict (top right) and the cards, chart and thresholds below every editor; three end values and a mileage typed for every car; each figure in four places (cards, side-by-side table, bottom line, month readout) and each card's breakdown as a sentence, a bar, a key and a table, all in grey hatching; engine words on the cards ("Equity at the horizon", "Opportunity cost", "Coverage", "Order").

### Decisions (CD1 to CD12, approved by the owner as proposed, 24 November 2026; detail in `docs/ui-patterns.md` and `docs/modelling-decisions-car.md`)

- **CD1.** A colour per option (`car-1` to `car-4`, existing palette steps) on its row, bars, chart line and tables; an icon for how the car is got. Colour never the only cue.
- **CD2.** Options as compact rows (icon, name, a one-line summary, its cost a month), tap to edit; one editor open at a time; shorter hints.
- **CD3.** Start from: Keep or replace, Cash or finance, Compare finance offers; sets the kinds and names only, no figures; Undo.
- **CD4.** Copy the car from another option: price, end values, mileage, fuel and running costs; not the name or finance.
- **CD5.** The answer as the headline (the verdict's gap a month, the total under it) and one coloured bar per option, ranked, with a table.
- **CD6.** One breakdown comparison: a stacked bar per option by cost part (`car-part-*` tokens, icons), a table fallback; slim cards (cost a month, total, three largest parts, money in and out).
- **CD7.** Plain labels: Yours at the end; Interest your cash could have earned; coverage only when short; no Order row; a rate under a tenth of a percent said with its fees.
- **CD8.** Results in sections with live summaries: the answer (always), where the money goes, month by month (net cost or cash paid so far), what changes the answer, how sure this is (three cases, sensitivity).
- **CD9.** Share on the shared dialog (image, PDF, CSV, text); amounts off: each option as a percentage above the lowest and parts as shares; a Show option names switch; nothing stored.
- **CD10.** Only the expected end value is required; low and high optional (empty reads as expected); the three cases show once any option has a range. Inputs version 4.
- **CD11.** One shared annual mileage, with a per-option "Drives a different distance" switch. Inputs version 4; version 3 migrates with the first entered mileage shared and options that differ keeping their own, identical figures.
- **CD12.** Sign-off from screenshots of the built page at 360 and 1280 px, light and dark.

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

- 24 November 2026 (0.38.0): car decision redesign (CD1 to CD12): inputs version 4 (optional range, shared mileage; tests first), `car-*` tokens, `style.ts`, `setup.ts` (Start from, Copy the car, row summaries, cost parts), option rows (`CarOptions.tsx`), the answer card, cost bars and slim cards, results in sections, the chart's cash view, Share (`share.ts`). Page height with three options: about 13,200 to 3,300 px on a laptop. Not done: Safari, a real phone, a screen reader.

## Next

- Car decision redesign merged; its open checks (Safari, a real phone, a screen reader) stay with the owner.
- Next redesign: compound interest; next pound lightly (its open checks are revisited then).

Full history (progress logs, finished part scopes, slice archives): `docs/history/` (grep it, don't read it whole).
