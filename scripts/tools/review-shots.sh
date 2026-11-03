#!/usr/bin/env bash
# Screenshots for a visual review round (code-plan §12.6): every NPC file, every continent's enemies, the successors, the races, the tools
# and the dragons, into <out-dir>. Needs the dev server (npm run dev, port 5173) and Google Chrome (scripts/tools/shot.mjs).
#   bash scripts/tools/review-shots.sh review/m7/shots
set -e
O=${1:?usage: review-shots.sh <out-dir>}
U=${URL:-http://localhost:5173}
mkdir -p "$O"
curl -s -o /dev/null -w '' "$U/characters.html" || { echo "dev server is not up at $U"; exit 1; }
for f in 01-azgar 02-morhaven 03-kaz-durum 04-nerea 05-aldria-a 06-aldria-b 07-mecharia 08-saharan 09-silvanel 10-nebulia; do
  node scripts/tools/shot.mjs "$U/characters.html?set=npc:$f&zoom=4" "$O/npc-$f.png" 1300 900 4000 >/dev/null &
done; wait
node scripts/tools/shot.mjs "$U/characters.html?set=successors&zoom=3" "$O/successors.png" 1300 900 4000 >/dev/null &
node scripts/tools/shot.mjs "$U/characters.html?set=races&zoom=3" "$O/races.png" 1300 900 4000 >/dev/null &
node scripts/tools/shot.mjs "$U/characters.html?set=tools&zoom=3" "$O/tools.png" 1300 900 4000 >/dev/null &
wait
for c in AZ MH KD NR AL MK SH SV NB; do
  ids=$(node -e "const e=require('./data/gen/enemies.json').items.items; console.log(e.filter(x=>(x.continents||[]).includes('$c')||x.id.startsWith('$c')).map(x=>x.id).join(','))")
  node scripts/tools/shot.mjs "$U/beasts.html?id=$ids&zoom=2" "$O/enemies-$c.png" 1300 900 5000 >/dev/null &
done; wait
node scripts/tools/shot.mjs "$U/beasts.html?set=dragons&zoom=2" "$O/dragons.png" 1300 900 5000 >/dev/null
# all the same size means the pages did not load
n=$(ls -l "$O"/*.png | awk '{print $5}' | sort -u | wc -l)
[ "$n" -gt 1 ] || { echo "every shot has the same size: the dev server is down?"; exit 1; }
ls "$O"
