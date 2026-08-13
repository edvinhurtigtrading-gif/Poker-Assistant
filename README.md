# Poker Assistant v0.4.1 — Auto Decision Mode

## New
- YOUR TURN banner whenever Hero is the active player.
- Hero seat glows strongly when it is Hero's turn.
- Equity calculation starts automatically.
- EV comparison starts automatically.
- A large recommendation card appears automatically.
- Recommendation shows:
  - Best action
  - Equity
  - Required equity
  - Estimated EV
  - CLEAR / MODERATE / CLOSE
  - Alternative EV values

## Important
The automatic recommendation uses the v0.4 model:
- estimated opponent range,
- estimated fold-to-raise frequency,
- simplified raise EV model.

It is not a GTO solution yet.

Next:
Action-based range narrowing, weighted ranges and sensitivity analysis.
