# Household budget

At `#/c/budget` (0.25.0; accounts, groups and sharing 0.33.0). Income after tax lands in a main account; outgoings are lines in groups, each paid from main or from another account (a spending account, a joint account or a savings pot) that gets a transfer from main. It shows what is left across accounts and in each, any account that runs short with a fix, where income goes, the biggest outgoings and a 50/30/20 check, a month or a year, with what-if sliders, and shares the result as an image, PDF, CSV or text. Uses no tax rules (`taxRules: 'none'`): no tax year, no config, no `requireVerified`. Decisions BD1 to BD17 in `docs/modelling-decisions.md` (BD10 to BD16 replace BD1 and BD6); page patterns U40 and U41 in `docs/ui-patterns.md`.

## Files

- `calc.ts`, `types.ts`: the pure engine, `budget(inputs)`: totals by group, each account's money in, paid, transfers out, left, saved (a savings pot) and short, the top-up, left over across accounts (may be below nothing), needs, wants and saving, shares of income as exact Ratios (null with no income), the savings rate, each line's year and month, the penny drift, warnings and assumptions; a typed refusal by line or account for anything outside the input limits, an account id that is not plain, or a line paid from an account that is not there.
- `definition.ts`: inputs version 3 (`pay`, `payPeriod`, `income`, `accounts` with `othersIn`, `outgoings`), the v1 and v2 migrations (BD15, BD17), the default template lines, validation (hostile keys, fresh objects, names tidied and cut), `toEngineInputs` (Your pay first), `withWhatIf` (transfers too), account templates, removal and new ids, `coveringMonthly` (the shortfall fix), section summaries, compare rows.
- `BudgetPage.tsx` and `page/`: the page (`Results.tsx`, `Accounts.tsx`, `LineEditor.tsx`, `style.tsx` for group colours and icons).
- `share/`: `summary.ts` (what a shared budget says, as text and CSV, with the formula guard), `card.ts` (the image card on a canvas), `ShareDialog.tsx` (the dialog and the print page).

## Assumptions

- Amounts are after tax, as entered. A blank amount is nothing.
- A year is exact: a weekly amount times the weeks in a year (`PERIODS_PER_YEAR`), and so on. A month is each yearly figure divided by the months, to the nearest penny; totals come from the years, so month rows can differ from their total by a penny or two, and the page says so.
- Shares are of total yearly income. The savings rate is the saving group plus what pots put aside, over income; what is left is not counted as saved (BD8, BD13).
- A card payment and the spending on that card would count twice. A transfer between the person's accounts is not an outgoing; each cost counts once, from the account that pays it. A joint account holds the person's own share.
- What is left in a savings pot is saved; what is left in main or a spending or joint account is left over. A shortfall is a top-up from main.

## Edge cases and their tests

| Case | Test |
|---|---|
| Each period converts exactly (weekly 100 is 5,200 a year) | `calc.test.ts` period conversion |
| Month figure rounding, the round trip for whole-month amounts | `calc.test.ts` |
| Blank amounts, no income (shares n/a), negative leftover (not capped) | `calc.test.ts` blank, zero and negative |
| Penny drift stated | `calc.test.ts`, `BudgetPage.test.tsx` |
| Amounts past the limit, unsafe numbers, bad periods, groups, kinds or essential flags, too many lines or accounts, bad or repeated account ids, a line paid from a missing account | `calc.test.ts` refusals, `definition.test.ts` |
| Groups and pots sum to outgoings; leftover = income − outgoings = the accounts' left less pots' saved; needs + wants + saving = outgoings; the top-up is every shortfall; a line never raises leftover; a transfer into a spending or joint account, or moving a line between them and main, never changes leftover; order does not matter | `properties.test.ts` (seeded) |
| The owner's setup: main 955, a spending account 230 short, a joint account at nothing, a pot putting 50 aside, 725 left across accounts; the fix clears the shortfall | `calc.test.ts` accounts, `BudgetPage.test.tsx` |
| A savings pot short; main below nothing while left over is positive | `calc.test.ts` |
| The v1 migration keeps left over, outgoings and the savings rate | `definition.test.ts`, `BudgetPage.test.tsx` |
| What others put in: into the account, not income; main unchanged; counts in left over; clears a joint shortfall; the fix allows for it | `calc.test.ts`, `BudgetPage.test.tsx`, `share/summary.test.ts` |
| Templates, account removal (lines to main) and new ids | `definition.test.ts`, `BudgetPage.test.tsx` |
| Share: no pound figure without amounts, no line names without names, a formula cell written as text, pounds from whole pence | `share/summary.test.ts`, `share/ShareDialog.test.tsx` |
| Hostile keys and bad shapes on import | `definition.test.ts` |
| What-ifs never stored; Apply with Undo | `definition.test.ts`, `BudgetPage.test.tsx` |
| Scenarios carry no tax year | `definition.test.ts` |

Mutation spot-checks (0.25.0): weekly counted as quarters fails 6 tests; yearly counted as months fails 6; a share over the wrong denominator fails 10; leftover capped at nothing fails 5. (0.33.0): pots not saving fails 5; transfers not out of main fails 4; no shortfall fails 2; needs including saving fails 1.

## Cross-check

No tax rule, so no GOV.UK source: every figure is a sum of what is entered, checked by hand in the tests (for example 3,000 a month pay and 1,200 a year side work is 37,200 a year).
