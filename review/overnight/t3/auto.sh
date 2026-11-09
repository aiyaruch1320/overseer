#!/bin/zsh
# auto.sh <maxloops> : continue play; answer prayers (alternate yes/no), continue at stops; break at death or a stop at age in $STOPAT list
cd /Users/aiyaruchphengthong/Learn/overseer/review/overnight/t3
n=0
for i in $(seq 1 ${1:-60}); do
  r=$(node cdp.mjs eval "(()=>{const b=document.body.innerText; return JSON.stringify({age:(b.match(/อายุ\s*(\d+)/)||[])[1], light:(b.match(/(\d+)\s*แสงศรัทธา/)||[])[1], stop:!!document.querySelector('[data-testid=stop]'), reason:document.querySelector('[data-testid=stop-reason]')?.innerText, prayer:!!document.querySelector('[data-testid=open-prayer]'), dead:/ฉากความตาย|อ่านบันทึกชีวิตของเขา/.test(b), panel:b.includes('หีบประทาน')&&b.includes('เสกตามใจ')})})()")
  echo "$r"
  case "$r" in *'"dead":true'*) echo DEAD; break;; esac
  if [[ "$r" == *'"stop":true'* ]]; then
    node cdp.mjs eval "document.querySelector('[data-testid=stop]').innerText.slice(0,260).replace(/\n+/g,' | ')"
    if [[ -n "$STOPAT" && "$r" == *"\"age\":\"$STOPAT\""* ]]; then echo STOPAT; break; fi
    node cdp.mjs click "ให้ชีวิตเดินต่อ" >/dev/null; sleep 1; node cdp.mjs click "เร็ว" >/dev/null
  elif [[ "$r" == *'"prayer":true'* ]]; then
    n=$((n+1)); node cdp.mjs clicksel "[data-testid=open-prayer]" >/dev/null; sleep 1
    if (( n % 2 == 0 )); then node cdp.mjs click "ปฏิเสธ" >/dev/null; else node cdp.mjs click "◌ ให้" >/dev/null || true; fi
    sleep .6; node cdp.mjs click "ยืนยัน" >/dev/null; sleep 1.2
    node cdp.mjs eval "document.querySelector('[data-testid=log]')?.innerText.split('\n').slice(-2).join(' | ').slice(0,300)"
    node cdp.mjs click "ปิด" >/dev/null; sleep .6; node cdp.mjs click "เร็ว" >/dev/null
  fi
  sleep 4
done
