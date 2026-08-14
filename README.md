# Poker Assistant v0.4.3

Fix for Auto Decision Mode hanging on ANALYZING.

## What changed
- Monte Carlo now runs in small asynchronous batches.
- The browser gets control back between batches, so the UI never freezes.
- Auto mode targets 800 simulations for fast decisions.
- Manual equity targets 5,000 simulations.
- Auto mode returns a quick partial estimate if the full run takes too long.
- Timeout can now actually execute because the browser event loop is not blocked.
- Partial deck shuffle is used for better speed.
- The decision panel displays how many simulations were used.

This is still an estimated range/EV model, not a GTO solver.
