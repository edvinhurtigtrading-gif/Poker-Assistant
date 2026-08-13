# Poker Assistant v0.2.1

Stabiliserad spelmotor ovanpå v0.2.

## Förbättrat
- Bettingrundor avslutas automatiskt när alla aktiva spelare har agerat och matchat aktuell bet.
- Automatisk övergång preflop → flop → turn → river.
- Board-kort låses tills rätt street.
- Nästa bettingrunda startar först när rätt board-kort matats in.
- Check är avstängd när spelaren måste syna.
- Call är avstängd när det inte finns något att syna.
- Bet och Raise visas bara som lagliga alternativ för rätt state.
- Fold och all-in hanteras i action order.
- Fold-win avslutar handen automatiskt.
- Undo finns kvar.
- Dealer/positioner roterar automatiskt mellan händer.

## Nästa steg
v0.3: Poker Math Engine — pot odds, required equity, SPR och första matematiska beslutsstödet.
