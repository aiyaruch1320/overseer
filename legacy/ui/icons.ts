// Hand-drawn 12×12 pixel icons. Each row is 12 chars; each char is a palette colour ('.' = transparent).
// Variants reuse a base bitmap with a character remap (e.g. a green skull for plague).

const PAL: Record<string, string> = {
  k: '#1b1626', w: '#f6f2e8', l: '#c9ccd6', s: '#8a90a0', d: '#4a4f60', g: '#f2c94c', G: '#b07a1e', y: '#fff2a0',
  r: '#e04848', R: '#8c2030', o: '#f08c3a', p: '#b07ae8', P: '#5e3a96', b: '#5aa0ea', B: '#2c5a9c', c: '#9ae6f6',
  n: '#6cc05a', N: '#2e7a3e', m: '#a06a42', M: '#5e3a26', f: '#f0c49a', i: '#ff9ac8', x: '#000000',
};

type Def = string[] | { base: string; map?: Record<string, string>; flipY?: boolean };

const SKULL = ['...kkkkkk...', '..kpppppPk..', '.kppppppppk.', '.kpkkppkkpk.', '.kpkkppkkpk.', '.kppppPppPk.', '..kpppkppk..', '...kPPPPk...', '...kpkpkk...', '...kkkkk....', '............', '............'];
const HEART = ['............', '.kkk...kkk..', 'krrrk.krrrk.', 'krwrrkrrrRk.', 'krrrrrrrrRk.', 'krrrrrrrrRk.', '.krrrrrrRk..', '..krrrrRk...', '...krrRk....', '....kRk.....', '.....k......', '............'];
const SPARK = ['.....kk.....', '.....yy.....', '....kyyk....', '....kyyk....', '.kkkyyyykkk.', 'kyyyywwyyyyk', 'kyyyywwyyyyk', '.kkkyyyykkk.', '....kyyk....', '....kyyk....', '.....yy.....', '.....kk.....'];
const EYE = ['............', '............', '...kkkkkk...', '..kPpppppk..', '.kPpwwwwpPk.', 'kPpwkkkkwpPk', 'kPpwkrrkwpPk', '.kPpwwwwpPk.', '..kPpppppk..', '...kkkkkk...', '............', '............'];
const SWORD = ['..........kk', '.........kwk', '........kwlk', '.......kwlk.', '......kwlk..', '.....kwlk...', '..k.kwlk....', '..kkwlk.....', '...kGk......', '..kGkGk.....', '.kGk.kk.....', '.kk.........'];
const WHEAT = ['.....k......', '....kgk.....', '...kgGgk....', '....kgk.....', '...kgGgk....', '....kgk.....', '...kgGgk....', '....kgk.....', '.....G......', '.....G......', '.....G......', '....kkk.....'];
const BOOK = ['............', '.kkkkkkkkkk.', '.kBbbbbbbBk.', '.kBbggggbBk.', '.kBbbbbbbBk.', '.kBbbggbbBk.', '.kBbbbbbbBk.', '.kBbbbbbbBk.', '.kBbbbbbbBk.', '.kBwwwwwwwk.', '.kkkkkkkkkk.', '............'];
const FEY = ['.kk......kk.', 'kcck....kcck', 'kccck..kccck', 'kcccckkcccck', '.kccckfkccck', '..kckfffkck.', '..kkkiiikkk.', '...kciiick..', '..kcck.kcck.', '..kck...kck.', '..kk.....kk.', '............'];
const DOWN = ['............', '............', '............', 'kk........kk', 'kwk......kwk', '.kwk....kwk.', '..kwk..kwk..', '...kwkkwk...', '....kwwk....', '.....kk.....', '............', '............'];

const ICONS: Record<string, Def> = {
  // god powers & resources
  bless: ['............', '.....gg.....', '..g..gg..g..', '...g....g...', '....gyyg....', 'gg.gyyyyg.gg', 'gg.gyyyyg.gg', '....gyyg....', '...g....g...', '..g..gg..g..', '.....gg.....', '............'],
  curse: SKULL,
  weapon: SWORD,
  dream: ['....kkk.....', '...kyyk.....', '..kyyk...g..', '.kyyk...ggg.', '.kyyk....g..', '.kyyk.......', '.kyyyk......', '.kyyyyk...kk', '..kyyyykkyyk', '...kyyyyyyk.', '....kkkkkk..', '............'],
  miracle: SPARK,
  fate: ['..kkkkkkkk..', '..kmmmmmmk..', '...krrrrk...', '...krRrrk...', '...krrRrk...', '...krrrRk...', '...krRrrk...', '..kmmmmmmk..', '..kkkkkkkk..', '.........r..', '..........r.', '...........r'],
  faith: ['.....k......', '....kok.....', '....kyok....', '...kyyok....', '...kywyk....', '....kyk.....', '...kwwwk....', '...kwlwk....', '...kwlwk....', '...kwlwk....', '..kGGGGGk...', '..kkkkkkk...'],
  dread: EYE,
  // stats & ui
  gold: ['...kkkkkk...', '..kgggggGk..', '.kggyggggGk.', '.kgyggkgggk.', '.kgygkkkggk.', '.kgggkgkggk.', '.kgggkkkgGk.', '.kggggkggGk.', '..kGgggGGk..', '...kkkkkk...', '............', '............'],
  fame: ['.....kk.....', '....kgyk....', '....kgyk....', 'kkkkkgyykkkk', 'kgyyyyyyyyGk', '.kGgyyyyyGk.', '..kGgyyyGk..', '..kgggGggk..', '.kggGkkGggk.', '.kgGk..kGgk.', '.kkk....kkk.', '............'],
  hp: HEART,
  heart: HEART,
  karma: ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwkdk.', '.kwwkkwwkddk', 'kwwwkkwkdddk', 'kwwwwwkddddk', 'kwwwwkdddddk', 'kwwwkddkkddk', '.kwwkddkkdk.', '.kwkddddddk.', '..kkddddkk..', '....kkkk....'],
  kill: ['kk........kk', 'kwk......kwk', '.kwk....kwk.', '..kwk..kwk..', '...kwkkwk...', '....kwwk....', '....kwwk....', '...kGkkGk...', '..kGk..kGk..', '.kmk....kmk.', 'kmk......kmk', 'kk........kk'],
  gear: ['....kkkk....', '.kk.kllk.kk.', '.klkkllkklk.', '..kllllllk..', 'kkllkkkkllkk', 'klllk..klllk', 'klllk..klllk', 'kkllkkkkllkk', '..kllllllk..', '.klkkllkklk.', '.kk.kllk.kk.', '....kkkk....'],
  home: ['.....kk.....', '....kRRk....', '...kRrrRk...', '..kRrrrrRk..', '.kRrrrrrrRk.', 'kkkkkkkkkkkk', '.kwwwwwwwwk.', '.kwkkwwmmwk.', '.kwkbwwmmwk.', '.kwwwwwmmwk.', '.kkkkkkkkkk.', '............'],
  castle: ['k.k.k..k.k.k', 'kkkkk..kkkkk', 'klllk..klllk', 'klllkkkklllk', 'kllllllllllk', 'klkllllllklk', 'kllllllllllk', 'kllllkkllllk', 'kllkMMMMkllk', 'kllkMMMMkllk', 'kkkkkkkkkkkk', '............'],
  target: ['.....kk.....', '...kkrrkk...', '..krrwwrrk..', '.krwwrrwwrk.', '.krwrrrrwrk.', 'krwrrkkrrwrk', 'krwrrkkrrwrk', '.krwrrrrwrk.', '.krwwrrwwrk.', '..krrwwrrk..', '...kkrrkk...', '.....kk.....'],
  plus: ['............', '....kkkk....', '....kwwk....', '....kwwk....', '.kkkkwwkkkk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kkkkwwkkkk.', '....kwwk....', '....kwwk....', '....kkkk....', '............'],
  minus: ['............', '............', '............', '............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............', '............', '............'],
  play: ['............', '..kk........', '..kwk.......', '..kwwk......', '..kwwwk.....', '..kwwwwk....', '..kwwwwk....', '..kwwwk.....', '..kwwk......', '..kwk.......', '..kk........', '............'],
  pause: ['............', '..kkk..kkk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '..kkk..kkk..', '............'],
  fast: ['............', 'kk....kk....', 'kwk...kwk...', 'kwwk..kwwk..', 'kwwwk.kwwwk.', 'kwwwwkkwwwwk', 'kwwwwkkwwwwk', 'kwwwk.kwwwk.', 'kwwk..kwwk..', 'kwk...kwk...', 'kk....kk....', '............'],
  dice: ['............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kwkkwwwwwk.', '.kwkkwwwwwk.', '.kwwwkkwwwk.', '.kwwwkkwwwk.', '.kwwwwwkkwk.', '.kwwwwwkkwk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............'],
  clover: ['...kk..kk...', '..knnkknnk..', '..knnnnnnk..', '...knnnnk...', '.kk.kNNk.kk.', 'knnkkNNkknnk', 'knnnnNNnnnnk', '.kk.kNNk.kk.', '.....kNk....', '......kNk...', '.......kk...', '............'],
  book: BOOK,
  scroll: ['............', '..kkkkkkkk..', '.kmyyyyyymk.', '..kyddddyk..', '..kyyyyyyk..', '..kyddddyk..', '..kyyyyyyk..', '..kydddyyk..', '..kyyyyyyk..', '.kmyyyyyymk.', '..kkkkkkkk..', '............'],
  globe: ['....kkkk....', '..kkbbbbkk..', '.kbnnbbbbbk.', '.kbnnnbbnbk.', 'kbbnnnbnnnbk', 'kbbbnbbnnnbk', 'kbbbbbbbnbbk', 'kbbnnbbbbbbk', '.kbnnnbbbbk.', '.kbbnnbbbbk.', '..kkbbbbkk..', '....kkkk....'],
  image: ['kkkkkkkkkkkk', 'kcccccccgggk', 'kccccccccgck', 'kcccccccccck', 'kccccnccccck', 'kcccnnnccnck', 'kccnnNnnnnnk', 'kcnnnnnNnnnk', 'knnNnnnnnnnk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk', '............'],
  check: ['............', '..........kk', '.........knk', '........knk.', '.......knk..', 'kk....knk...', 'knk..knk....', '.knkknk.....', '..knnk......', '...kk.......', '............', '............'],
  cross: ['............', 'kk......kk..', 'krk....krk..', '.krk..krk...', '..krkkrk....', '...krrk.....', '...krrk.....', '..krkkrk....', '.krk..krk...', 'krk....krk..', 'kk......kk..', '............'],
  warning: ['.....kk.....', '....kyyk....', '....kyyk....', '...kyyyyk...', '...kykkyk...', '..kyykkyyk..', '..kyykkyyk..', '.kyyykkyyyk.', '.kyyyyyyyyk.', 'kyyyykkyyyyk', 'kyyyyyyyyyyk', 'kkkkkkkkkkkk'],
  bubble: ['............', '..kkkkkkk...', '.kwwwwwwwk..', 'kwwwwwwwwwk.', 'kwwwwwwwwwk.', 'kwwwwwwwwwk.', '.kwwwwwwwk..', '..kkkkkkk...', '...kwk......', '....kk......', '..kwk.......', '..kk........'],
  hourglass: ['kkkkkkkkkkkk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '.....kk.....', '.....kk.....', '....kmyk....', '...kmmyyk...', '..kmyyyyyk..', '.kyyyyyyyyk.', 'kkkkkkkkkkkk'],
  down: DOWN,
  up: { base: 'down', flipY: true },
  // world & events
  war: { base: 'kill' },
  plague: { base: 'curse', map: { p: 'n', P: 'N' } },
  famine: { base: 'wheat', map: { g: 'm', G: 'M' } },
  golden: { base: 'miracle', map: { y: 'g', w: 'y' } },
  omen: ['....oooo....', '..oooooooo..', '.ookkkkkkoo.', '.okddddddko.', 'ookddddddkoo', 'ookddddddkoo', 'ookddddddkoo', 'ookddddddkoo', '.okddddddko.', '.ookkkkkkoo.', '..oooooooo..', '....oooo....'],
  death: ['............', '...kkkkkk...', '..klllllllk.', '.klllkklllk.', '.klkkkkkklk.', '.klllkklllk.', '.klllkklllk.', '.kllllllllk.', '.kllllllllk.', '.kssssssssk.', 'nkkkkkkkkkkn', 'nnnnnnnnnnnn'],
  monster: ['............', '.k...k...k..', '.rk..rk..rk.', '..rk..rk..rk', '..rk..rk..rk', '...rk..rk..r', '...rk..rk..r', '....rk..rk..', '....rk..rk..', '.....r...r..', '............', '............'],
  secret: { base: 'miracle', map: { y: 'p', w: 'c' } },
  job: { base: 'scroll' },
  move: ['............', '...kkkk.....', '...kmmk.....', '...kmmk.....', '...kmmk.....', '...kmmk.....', '...kmmkkkk..', '..kmmmmmmmk.', '..kmmmmmmmmk', '..kMMMMMMMMk', '..kkkkkkkkkk', '............'],
  birth: ['............', '...kkkkkk...', '..kffffffk..', '.kffffffffk.', '.kfkffffkfk.', '.kffffffffk.', '.kfiffffifk.', '.kffkkkkffk.', '..kffffffk..', '...kkkkkk...', '..kiiiiiik..', '..kkkkkkkk..'],
  tone_dark: ['.....kk.....', '.....rk.....', '....krrk....', '....krrk....', '...krrrrk...', '..krrrrrRk..', '..krwrrrRk..', '.krwrrrrrRk.', '.krrrrrrrRk.', '..krrrrRRk..', '...kRRRRk...', '....kkkk....'],
  tone_grim: { base: 'curse', map: { p: 'l', P: 's' } },
  tone_warm: ['.....gg.....', '.g...gg...g.', '..g......g..', '....kkkk....', '...kyyyyk...', 'gg.kyyyyk.gg', 'gg.kyyyyk.gg', '...kyyyyk...', '....kkkk....', '..g......g..', '.g...gg...g.', '.....gg.....'],
  tone_comedy: ['............', '.kkkkkkkkkk.', 'kcccccccccck', 'kckkcccckkck', 'kckkcccckkck', 'kcccccccccck', 'kckcccccckck', 'kcckkkkkkcck', '.kcccccccck.', '..kcccccck..', '...kkkkkk...', '............'],
  rain: ['............', '....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kllllllllllk', '.kkkkkkkkkk.', '..b..b..b...', '.b..b..b..b.', 'b..b..b..b..', '..b..b..b...', '............'],
  meteor: ['........kk..', '.......kook.', '......koyok.', '......koook.', '.......kkk..', '......o.....', '.....o......', '....r.......', '...o........', '..r.........', '.o..........', '............'],
  quake: ['............', '............', '............', '............', 'kkkkkkkkkkkk', 'kmmmmkmmmmmk', 'kmmmkMkmmmmk', 'kmmmmkMkmmmk', 'kMMMkMMkMMMk', 'kMMMMkMMMMMk', 'kMMMMkMMMMMk', 'kkkkkkkkkkkk'],
  heal: ['............', '.kkk...kkk..', 'kiiik.kiiik.', 'kiiiikiiiik.', 'kiiikwkiiik.', 'kiikwwwkiik.', 'kiiikwkiiik.', '.kiiiiiiik..', '..kiiiiik...', '...kiiik....', '....kik.....', '.....k......'],
  angel: { base: 'fey', map: { c: 'w', f: 'y', i: 'y' } },
  // relations
  mentor: ['.....k......', '....kbk.....', '....kbk.....', '...kbbbk....', '...kbgbk....', '..kbbbbbk...', '..kbbbbgk...', '.kbbgbbbbk..', '.kbbbbbbbk..', 'kkkkkkkkkkkk', 'kBBBBBBBBBBk', 'kkkkkkkkkkkk'],
  rival: ['......kkkk..', '.....kyyk...', '....kyyk....', '...kyyk.....', '..kyyykkkk..', '.kyyyyyyyk..', '.kkkkyyyk...', '....kyyk....', '...kyyk.....', '..kyyk......', '.kyk........', '.kk.........'],
  lover: { base: 'heart', map: { r: 'i', R: 'r' } },
  spouse: ['....kkkk....', '....kcck....', '.....kk.....', '...kkkkkk...', '..kgggggGk..', '.kgk....kGk.', '.kgk....kGk.', '.kgk....kGk.', '.kgk....kGk.', '..kgggggGk..', '...kkkkkk...', '............'],
  nemesis: ['..........kk', '.........krk', '........krRk', '.......krRk.', '......krRk..', '.....krRk...', '..kk.kRk....', '..kMkkk.....', '...kMk......', '..kMkMk.....', '.kMk.kk.....', '.kk.........'],
  friend: ['............', '.kkk....kkk.', 'kfffk..kfffk', 'kfkfk..kfkfk', 'kfffk..kfffk', '.kkk....kkk.', 'kbbbk..knnnk', 'kbbbbkknnnnk', 'kbbbbbnnnnnk', 'kbbbk..knnnk', 'kbbbk..knnnk', 'kkkkk..kkkkk'],
  child: { base: 'birth' },
  parent: { base: 'home' },
  // dream symbols
  snake: ['............', '......kkkk..', '.....knnnnk.', '.....knkrnk.', '......knnk..', '.kkkkkknk...', 'knnnnnnnk...', 'knkkkkkk....', 'knnnnnnnnk..', '.kkkkkkkknk.', '.......knnk.', '........kk..'],
  fire: ['.....k......', '....kok.....', '....kook....', '...koook.k..', '..kooook.ok.', '.kooroooook.', '.koorrooook.', '.kooryroook.', '.koryyyrook.', '.korywyrok..', '..koryrook..', '...kkkkkk...'],
  river: ['............', '............', '...kkk......', '..kbbbk...kk', '.kbcbbbk.kbk', 'kbcbkbbbkbbk', 'kbbk..kbbbk.', '.kk....kkk..', '...kkk......', '..kbbbk...kk', '.kbcbbbk.kbk', 'kbbk.kbbbbk.'],
  sword: SWORD,
  eye: { base: 'dread', map: { P: 'd', p: 'l', r: 'b' } },
  moon: { base: 'dream' },
  flower: ['............', '....kiik....', '.kk.kiik.kk.', 'kiikkiikkiik', 'kiiiiyyiiiik', '.kkiyyyyikk.', 'kiiiiyyiiiik', 'kiikkiikkiik', '.kk.kiik.kk.', '....kiik....', '.....nn.....', '....nNNn....'],
  crow: ['............', '......kkk...', '.....kdddk..', '.....kdrdkss', '....kdddddk.', '..kkdddddk..', '.kddddddddk.', 'kddddddddk..', '.kkdddddk...', '...kdkdk....', '...ks.ks....', '..ks.ks.....'],
  crown: ['............', '............', 'k....k....k.', 'kgk.kgk..kgk', 'kggkgggkkggk', 'kgggggggggGk', 'kgrggbggrgGk', 'kgggggggggGk', 'kGGGGGGGGGGk', 'kkkkkkkkkkkk', '............', '............'],
  door: ['...kkkkkk...', '..kmmmmmmk..', '.kmMmmmmMmk.', '.kmMmmmmMmk.', '.kmMmmmmMmk.', '.kmMmmmmMmk.', '.kmMmmgmMmk.', '.kmMmmmmMmk.', '.kmMmmmmMmk.', '.kmMmmmmMmk.', '.kmmmmmmmmk.', 'kkkkkkkkkkkk'],
  mountain: ['............', '.....kk.....', '....kwwk....', '...kwwlsk...', '...kslsskkk.', '..kssssskwwk', '.kssdssslssk', '.ksssssdsssk', 'kssdsssssssk', 'ksssssdssssk', 'kddddddddddk', 'kkkkkkkkkkkk'],
  // climates
  temperate: WHEAT,
  wheat: WHEAT,
  tropical: ['.kk....kk...', 'knnk..knnk..', '.knnkknnk...', 'kknnnnnnkk..', 'knk.kmk.knk.', '.k..kmk..k..', '....kmk.....', '.....kmk....', '.....kmk....', '.....kmk....', '...kyyyyyk..', '..kkkkkkkkk.'],
  desert: ['....kkk.....', '...knnnk....', '...knNnk.kk.', '.kk.knNnkknk', 'knnkknnnknnk', 'knnnnnNnnnk.', '.kkknnnnkkk.', '...knNnk....', '...knnnk....', '...knNnk....', '.kkkkkkkkkk.', '.kyyyyyyyyk.'],
  frozen: ['.....c......', '...c.c.c....', '....ccc.....', '.c...c...c..', '..c..c..c...', 'cccccwccccc.', '..c..c..c...', '.c...c...c..', '....ccc.....', '...c.c.c....', '.....c......', '............'],
  volcanic: ['....r.o.....', '...o.r.o....', '....orr.....', '....kook....', '...kMrrMk...', '...kMoMMk...', '..kMMrMMMk..', '..kMMMoMMk..', '.kMMMMMMMMk.', '.kMMMMMMMMk.', 'kMMMMMMMMMMk', 'kkkkkkkkkkkk'],
  islands: ['...kk.kk....', '..knnknnk...', '...knnnk....', '....kmk.....', '.....mk.....', '.....mk.....', '...kyyyyk...', '.kyyyyyyyyk.', 'bbbbbbbbbbbb', 'cbbbcbbbbcbb', 'bbbbbbbbbbbb', 'bbcbbbbcbbbb'],
  // monster families (also used as battle sprites)
  beast: ['.k........k.', '.kk......kk.', '.ksk....ksk.', '.kssk..kssk.', '.ksssskksssk', 'kssssssssssk', 'kssrksskrssk', 'kssssssssssk', '.ksssllsssk.', '..kslkklsk..', '...kswwsk...', '....kkkk....'],
  undead: { base: 'curse', map: { p: 'l', P: 's' } },
  dragon: ['..k...k.....', '..rk..rk....', '...rkkrk....', '..krrrrrkk..', '.krrykrrrrk.', '.krrrrrrrrrk', 'krrrrrrwkwrk', 'kRrrrrrkkkk.', '.kRRrrrk....', '..kRRrrk....', '...kRRrrk...', '....kkkkk...'],
  demon: ['k..........k', 'kk........kk', '.kk.kkkk.kk.', '..kkRRRRkk..', '..kRrrrrRk..', '.kRryrryrRk.', '.kRrkrrkrRk.', '.kRrrrrrrRk.', '.kRrwkkwrRk.', '..kRrrrrRk..', '...kRRRRk...', '....kkkk....'],
  humanoid: ['............', '....kkkk....', '...knnnnk...', 'kkknnnnnnkkk', '.knnynnynnk.', '..knnnnnnk..', '..knwkkwnk..', '...knnnnk...', '..kmmmmmmk..', '.kmmmmmmmmk.', '.kmmmmmmmmk.', '.kkkkkkkkkk.'],
  spirit: ['....kkkk....', '..kkwwwwkk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', 'kwwkkwwkkwwk', 'kwwwwwwwwwwk', 'kwwwwkkwwwwk', 'kwwwwkkwwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwkwwkkwwkwk', 'k.kkk..kkk.k'],
  ufo: ['............', '....kkkk....', '...kccwck...', '...kcccck...', '.kkkkkkkkkk.', 'kllllllllllk', 'klylllylllyk', 'kssssssssssk', '.kkkkkkkkkk.', '...c....c...', '..c......c..', '.c........c.'],
  whale: ['............', '............', '.........k.k', '..kkkkk..kbk', '.kbbbbbkkbk.', 'kbwbbbbbbbk.', 'kbbbbbbbbbk.', 'kccccccbbk..', '.kcccccckk..', '..kkkkkk....', '............', '............'],
  tentacle: ['.......kk...', '......kpPk..', '.......kpk..', '..kk...kpk..', '.kpPk.kppk..', '.kpk..kpk...', '.kppkkppk...', '..kpppppk...', '...kpppk....', 'BBBBkpkBBBBB', 'bbbbbbbbbbbb', 'BBBBBBBBBBBB'],
  eclipse: ['....kkkk....', '..kkyyyykk..', '.kyykkkkyyk.', '.kykxxxxkyk.', 'kykxxxxxxkyk', 'kykxxxxxxkyk', 'kykxxxxxxkyk', 'kykxxxxxxkyk', '.kykxxxxkyk.', '.kyykkkkyyk.', '..kkyyyykk..', '....kkkk....'],
  wave: ['............', '............', '....kkk.....', '..kkcwck....', '.kbbbcck.k..', 'kbbbbbbckck.', 'kbbbbbbbbbck', 'BbbbbbbbbbbB', 'BBbbbbbbbbBB', 'BBBBbbbbBBBB', 'BBBBBBBBBBBB', '............'],
  lantern: ['.....kk.....', '....kGGk....', '...kooook...', '..koyyyyok..', '..koywwyok..', '..koyyyyok..', '..koyyyyok..', '...kooook...', '....kGGk....', '.....kk.....', '.....r......', '....r.......'],
  mask: ['............', '.kkkkkkkkkk.', 'kppppppppppk', 'kpkkppppkkpk', 'kpkkppppkkpk', 'kppppggppppk', '.kppppppppk.', '..kppkkppk..', '...kpppk....', '....kkk.....', '............', '............'],
  mug: ['............', '..wwwwww....', '.kwwwwwwk...', '.kGggggGkkk.', '.kgggggGk.k.', '.kgggggGk.k.', '.kgggggGk.k.', '.kgggggGkkk.', '.kgggggGk...', '.kGGGGGGk...', '.kkkkkkkk...', '............'],
  giant: ['...kkkkkk...', '..kMmmmmMk..', '.kmmmmmmmmk.', '.kmkkmmkkmk.', 'kmmkymmykmmk', 'kmmmmmmmmmmk', 'kmmmmmMmmmmk', 'kmmwkkkkwmmk', '.kmwmmmmwmk.', '.kmmkkkkmmk.', '..kmmmmmmk..', '...kkkkkk...'],
  construct: ['.kkkkkkkkkk.', '.kssssssssk.', '.kslllllssk.', '.kskckkcksk.', '.kssssssssk.', 'kkksssssskkk', 'kssksssskssk', 'kssksssskssk', 'kkkskkkkskkk', '..ksk..ksk..', '.kssk..kssk.', '.kkkk..kkkk.'],
  sea: ['....kkkk....', '...kppppk...', '..kppppppk..', '..kppppppk..', '..kpwppwpk..', '..kpkppkpk..', '..kppppppk..', '.kpkpkkpkpk.', '.kpkpkkpkpk.', 'kpk.kpkk.kpk', 'kk..kpk..kk.', '....kk......'],
  plant: ['...kkkkkk...', '.kknnNnnnkk.', 'knnnNnnnnnnk', 'knnnnnnNnnnk', '.kknnnnnnkk.', '...kmmmmk...', '...kykkyk...', '...kmmmmk...', '...kmkkmk...', '..kmmmmmmk..', '.kmk.kk.kmk.', '.kk......kk.'],
  fey: FEY,
  amorphous: ['............', '............', '.....kk.....', '....kbbk....', '...kbcbbk...', '..kbccbbbk..', '.kbbbbbbbbk.', '.kbkbbbbkbk.', 'kbbkbbbbkbbk', 'kbbbbbbbbbbk', 'kBbbbbbbbbBk', '.kkkkkkkkkk.'],
  insect: ['........kk..', '.......krrk.', '........kRk.', '........kRk.', 'kk.....kRk..', 'krk...kRk...', '.kRkkkRRkk..', '..kRRRRRRRk.', '.kkRkRkRkRk.', 'kRk.kRk.kRk.', '............', '............'],
  bird: ['............', 'kk..........', 'kgkk........', '.kggkk......', '.kgggggk....', '..kgggggkkk.', '...kgGggggyk', '...kGgggkkk.', '....kGGk....', '...kk.kk....', '............', '............'],
  bandit: ['....kkkk....', '...kddddk...', '..kddddddk..', '..kdkkkkdk..', '..kdkykykdk.', '..kdkkkkdk..', '.kddddddddk.', 'kddsddddsddk', 'kddddddddddk', 'kddddddddddk', '.kdddkkdddk.', '.kkkk..kkkk.'],
  // careers
  bow: ['..kk........', '..kmk.......', '...kmk......', '...l.mk.....', '...l..mk.k..', 'kssssssmskk.', '...l..mk.k..', '...l.mk.....', '...kmk......', '..kmk.......', '..kk........', '............'],
  shield: ['.kkkkkkkkkk.', '.kbbbbbbbbk.', '.kbbbggbbbk.', '.kbbbggbbbk.', '.kbggggggbk.', '.kbggggggbk.', '.kbbbggbbbk.', '.kbbbggbbbk.', '..kbbggbbk..', '...kbbbbk...', '....kbbk....', '.....kk.....'],
  orb: ['............', '....kkkk....', '...kccbbk...', '..kcwcbbbk..', '..kcccbbbk..', '..kbbbbbBk..', '...kbbbBk...', '....kkkk....', '...kGGGGk...', '..kGggggGk..', '..kGGGGGGk..', '..kkkkkkkk..'],
  key: ['............', '..kkkk......', '.kgggGk.....', '.kgkkgk.....', '.kgkkgk.....', '.kgggGkkkkk.', '..kkkkgggGk.', '......kgkGk.', '......kk.kk.', '............', '............', '............'],
  hammer: ['............', '.kkkkkkk....', '.kssslssk...', '.kssssssk...', '..kkkmkk....', '....kmk.....', '....kmk.....', '....kmk.....', '....kmk.....', '....kMk.....', '....kMk.....', '....kkk.....'],
  note: ['...kkkkkkk..', '...kpppppk..', '...kpkkkkk..', '...kpk..kpk.', '...kpk..kpk.', '...kpk..kpk.', '.kkkpk.kkpk.', 'kpppk.kpppk.', 'kpppk.kpppk.', '.kkk...kkk..', '............', '............'],
  fish: ['............', '............', '....kkkk....', '..kkbbbbk.k.', '.kbwkbbbbkbk', 'kbbkkbbbbbbk', 'kbbbbbbbbbbk', '.kbbbbbbbkbk', '..kkbbbbk.k.', '....kkkk....', '............', '............'],
  leaf: ['........kkk.', '......kknnk.', '.....knnnnk.', '....knnNnnk.', '...knnNnnk..', '..knnNnnnk..', '..knNnnnk...', '.knNnnnk....', '.kNnnkk.....', '.kNkk.......', 'kNk.........', 'kk..........'],
  pot: ['....k..k....', '...k..k.....', '....k..k....', '.kkkkkkkkkk.', 'kssllllllssk', '.kssssssssk.', 'kksssssssskk', '.kssssssssk.', '.kssssssssk.', '.kdsssssssk.', '..kddddddk..', '...kkkkkk...'],
  paw: ['............', '..kk....kk..', '.kmmk..kmmk.', '.kmmk..kmmk.', 'kk.kk..kk.kk', 'kmk.kkkk.kmk', '.k.kmmmmk.k.', '..kmmmmmmk..', '.kmmmmmmmmk.', '.kmmmmmmmmk.', '..kmmkkmmk..', '...kk..kk...'],
  halo: ['............', '..kkkkkkkk..', '.kyyyyyyyyk.', 'kyykkkkkkyyk', '.kyyyyyyyyk.', '..kkkkkkkk..', '....kffk....', '...kffffk...', '...kffffk...', '....kffk....', '..kwwwwwwk..', '..kkkkkkkk..'],
  fangs: ['............', '.kkkkkkkkkk.', 'kRRRRRRRRRRk', 'kRwkwwwwkwRk', 'kRwk....kwRk', '.kwk....kwk.', '..k......k..', '............', '.....r......', '.....r......', '....rrr.....', '....kkk.....'],
  jolly: ['k...........', 'kkkkkkkkkkk.', 'kddddwwddddk', 'kdddwwwwdddk', 'kdddwkkwdddk', 'kddddwwddddk', 'kdwdddddwddk', 'kddwwddwwddk', 'kdwdddddwddk', 'kkkkkkkkkkk.', 'k...........', 'k...........'],
  darkbook: { base: 'book', map: { B: 'P', b: 'p', g: 'r' } },
  goldbook: { base: 'book', map: { B: 'G', b: 'g', g: 'w' } },
  goldshield: { base: 'shield', map: { b: 'g', g: 'w' } },
  herosword: { base: 'weapon', map: { w: 'y', l: 'g' } },
  lich: { base: 'curse', map: { p: 'c', P: 'B' } },
  icedragon: { base: 'dragon', map: { r: 'b', R: 'B', y: 'w' } },
  yeti: { base: 'giant', map: { m: 'l', M: 's' } },
};

const cache = new Map<string, string>();
const canvases = new Map<string, HTMLCanvasElement>();

function rows(name: string): string[] {
  const d = ICONS[name] ?? ICONS.secret;
  if (Array.isArray(d)) return d;
  let r = rows(d.base);
  if (d.map) r = r.map((row) => row.replace(/./g, (ch) => d.map![ch] ?? ch));
  if (d.flipY) r = [...r].reverse();
  return r;
}

export const hasIcon = (name: string) => name in ICONS;

export function iconCanvas(name: string, scale = 2): HTMLCanvasElement {
  const key = `${name}@${scale}`;
  const hit = canvases.get(key);
  if (hit) return hit;
  const r = rows(name);
  const cv = document.createElement('canvas');
  cv.width = 12 * scale; cv.height = 12 * scale;
  const ctx = cv.getContext('2d')!;
  r.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = PAL[ch];
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  canvases.set(key, cv);
  return cv;
}

export function iconUrl(name: string): string {
  let u = cache.get(name);
  if (!u) { u = iconCanvas(name, 4).toDataURL(); cache.set(name, u); }
  return u;
}

// <img> markup for an icon (size in CSS px)
export function ic(name: string, size = 18, cls = ''): string {
  return `<img class="px ${cls}" src="${iconUrl(name)}" width="${size}" height="${size}" alt="">`;
}

export const ICON_NAMES = Object.keys(ICONS);
