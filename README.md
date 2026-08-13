# Poker Assistant v0.3

v0.3 lägger till den första riktiga matematikmotorn ovanpå v0.2.2.

## Nytt i v0.3
- Pot before action
- Amount to call
- Pot odds
- Required equity
- Effective stack
- SPR
- Automatisk matematisk förklaring när Hero står på tur
- Matematikpanelen uppdateras automatiskt från bordets Game State

## Formler

### Required equity / pot odds för call
Required Equity = Call Amount / Final Pot After Call

Exempel:
Pot före call: 20 BB
Call: 5 BB
Final pot efter call: 25 BB
Required equity: 5 / 25 = 20%

### SPR
SPR = Effective Stack / Pot

SPR visas postflop.

## Viktigt
v0.3 gör ännu ingen equity-estimering mot opponent ranges och rekommenderar därför ännu inte Fold/Call/Raise baserat på full EV.

Nästa steg:
v0.4 — equity mot ranges, combos/blockers och EV-jämförelse.
