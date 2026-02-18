# Critter stat balance guide

This doc describes target roles and level requirements for critters. Adjust **base stats** and **stat deltas per level** in Critter Admin (or via a one-off script); do not change existing mission or progress values.

## Target roles

- **Buddo**: Tanky, slower, decent attack — high HP/DEF, lower SPD, mid ATK.
- **Mothwick**: Glass cannon with some bulk — high ATK/SPD, lower HP/DEF.
- **Driplotl**: Middle ground, slowest — balanced bulk + damage, lowest SPD.
- **Moolnir**: First-route, bulky, meh damage — high HP/DEF, low ATK.
- **Ragnir**: Later (e.g. 2nd gym), higher stats when unlocked.
- **Glimcap**: Starter route, frailer, hits slightly harder than Moolnir early; Moolnir scales better with levels.

## Level and mission requirements

- Each critter should have **at least 5 level rows** with **stat deltas**.
- Each level should have **one “knockout any critter” style mission** (e.g. `opposing_knockouts` or equivalent in `CritterLevelMissionRequirement`).
- Use **Skill Unlock IDs** in each level row to grant moves as the critter levels up; movepool is derived from level and `skillUnlockIds`.

## Implementation

- Edit base stats and level stat deltas in **Admin → Critters**.
- Optional: add a small migration helper script that *suggests* baseStats + level stat deltas for known critter names and outputs JSON, without overwriting the DB.
