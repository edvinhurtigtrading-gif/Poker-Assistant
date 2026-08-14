# Poker Assistant v0.4.5 — Corrected EV Engine

Raise EV is now more conservative.

- Villain range split into fold / call / reraise branches.
- Hero equity versus calling range is reduced versus full range.
- Reraise branch assumes Hero can lose the raise investment.
- Sensitivity test uses fold-frequency ±10 percentage points.
- If the best action changes across assumptions, recommendation becomes NO CLEAR EDGE.
- Added estimated reraise frequency control.

This is still an estimate, not a GTO solver.
