# Laptop restore drill — SSmart POS

The laptop app backs itself up automatically (daily on launch, re-checked
every 6 hours, 30 backups kept in the app's `backups/` folder next to the
database). A backup is only useful if a restore has been tried once.
Do this drill once, on a quiet evening, before you ever need it for real.

## Before you start

- Close the SSmart POS app completely.
- Know where the live database is: the app data folder
  (`%APPDATA%/ssmart-pos/` on the shop laptop), file `mart-pos.db`.
- Never wipe or reinstall the app to "fix" a database problem — the
  local database is the shop's record. A restore replaces one file.

## The drill (15 minutes)

1. In the app data folder, copy `mart-pos.db` to `mart-pos.db.drill-copy`.
   This is your way back if anything in the drill goes wrong.
2. In the `backups/` folder, pick any backup file (they are dated).
   Copy it — do not move it — over `mart-pos.db`.
3. Open the app. Check three things: today's sales total, one customer's
   khata balance, and one vendor's due amount. Compare them with what
   you expect from that backup's date (older backup = older numbers;
   that is correct).
4. Close the app, delete the restored `mart-pos.db`, and rename
   `mart-pos.db.drill-copy` back to `mart-pos.db`.
5. Open the app again and confirm today's numbers are back. The drill
   is done only when step 5 shows the real data.

## If the numbers in step 3 look wrong

- You probably picked the wrong backup file. Repeat with a different
  dated file. The drill copy from step 1 keeps the real data safe
  throughout.
- If no backup restores sensibly, stop and ask for help before touching
  the live database again — do not delete anything in `backups/`.

## Honest limitation

All 30 backups live on the same laptop as the database. They protect
against a bad update, a bad sync, or a mistaken delete — not against
the laptop itself being stolen or its disk dying. Once a month, copy
the newest backup file to a USB stick and keep it off the machine.
