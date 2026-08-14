# Poker Assistant v0.4.4

Critical Auto Decision fix.

## Root cause found
The Auto Decision UI appeared, but the JavaScript state variables used by the analysis engine were never declared:
- autoAnalysisToken
- lastAutoSignature
- autoAnalysisRunning
- autoAnalysisTimeout

The first automatic analysis therefore threw a ReferenceError immediately after showing the popup.

## Fixes
- Added all missing auto-analysis state declarations.
- Keeps the asynchronous batched Monte Carlo engine from v0.4.3.
- Added a visible runtime-error fallback so future JavaScript failures show ANALYSIS ERROR instead of silently hanging.

Auto analysis:
- up to 800 simulations
- batched to keep UI responsive
- quick estimate if needed

This remains an estimated range/EV model, not GTO.
