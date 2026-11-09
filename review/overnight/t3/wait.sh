#!/bin/zsh
# wait.sh <maxloops> : poll until a card/stop/death appears
cd /Users/aiyaruchphengthong/Learn/overseer/review/overnight/t3
for i in $(seq 1 ${1:-30}); do
  r=$(node cdp.mjs eval "(()=>{const b=document.body.innerText; const cards=[...document.querySelectorAll('[data-testid=card]')].map(c=>c.innerText.replace(/\n+/g,' / ')); return JSON.stringify({age:(b.match(/อายุ\s*(\d+)/)||[])[1], light:(b.match(/(\d+)\s*แสงศรัทธา/)||[])[1], stop:b.includes('ให้ชีวิตเดินต่อ'), stopEl:!!document.querySelector('[data-testid=stop]'), cards, dead:/ฉากความตาย|อ่านบันทึกชีวิตของเขา/.test(b)})})()")
  echo "$r"
  case "$r" in *'"stop":true'*|*'"stopEl":true'*|*'"dead":true'*|*'"cards":["'*) break;; esac
  sleep 4
done
