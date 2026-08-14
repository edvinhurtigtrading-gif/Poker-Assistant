# Poker Assistant v0.4.2

Fixes Auto Decision Mode.

## Improvements
- Auto analysis uses 3,000 Monte Carlo runs for faster decisions.
- Manual Calculate Equity still uses 10,000 runs.
- Added a 2.5 second analysis timeout.
- Added ANALYSIS ERROR / INSUFFICIENT DATA fallback.
- Prevented stale auto-analysis state from getting stuck on ANALYZING.
- Added validation around empty ranges and incomplete simulation states.

The EV/range model is still simplified and not GTO.
