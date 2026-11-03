// The part ids the Looks may name (the vocabulary between the docs' words and the painter). The codegen of looks maps the words of the
// appearance docs to these ids only; the part tables (outfits.ts, hair.ts, hats.ts, tools.ts, feats.ts) must draw every one of them
// (tests/art/parts.test.ts). Taken from the vector POC's lists (docs/appearance/poc-visuals/README.md) and the races' feats (02-races.md).

export const OUTFIT_IDS = [
  'tunic', 'robe', 'cape', 'cloak', 'armor', 'plate', 'knight', 'leather', 'light', 'fur', 'rags', 'apron', 'miner',
  'noble', 'regal', 'priest', 'scholar', 'dress', 'sarong', 'sailor', 'otherworld',
] as const;

export const HAIR_IDS = ['short', 'long', 'bald', 'braid', 'bun', 'ponytail', 'topknot', 'curly', 'wild', 'cropped', 'mohawk', 'tied'] as const;

export const BEARD_IDS = ['short', 'long', 'braided', 'stubble', 'moustache'] as const;

export const HAT_IDS = [
  'hood', 'cowl', 'helmet', 'horned', 'wide', 'straw', 'cap', 'bandana', 'chef', 'circlet', 'crown', 'tiara', 'laurel',
  'feather', 'furhat', 'goggles', 'minerhat', 'mitre', 'turban', 'veil', 'wizard',
] as const;

export const TOOL_IDS = [
  'spear', 'trident', 'staff', 'orbstaff', 'crook', 'cane', 'scepter', 'wand', 'banner', 'scythe', 'censer', 'sword', 'greatsword',
  'dagger', 'mace', 'club', 'hammer', 'axe', 'pickaxe', 'hoe', 'shovel', 'broom', 'ladle', 'bow', 'rod', 'book', 'ledger', 'scroll',
  'lute', 'mug', 'bowl', 'flask', 'lantern', 'shield',
  // added after the first set (tools-extra.ts): guns, instruments, a fan, scissors, a whip, a sling, a fist weapon
  'pistol', 'musket', 'rifle', 'spyglass', 'compass', 'pocketwatch', 'fan', 'scissors', 'gauge', 'whip', 'sling', 'knuckles',
  // wave 4 (tools-extra.ts): the things the docs name that fell to a generic book or box
  'keyring', 'basket', 'garland', 'mallet', 'bellrope', 'beads', 'doll', 'bucket', 'papyrus', 'card', 'letter', 'crystal', 'jar', 'net',
  'brush', 'map', 'bottle', 'pipe', 'bag', 'hotiron', 'tank', 'quill', 'chalk',
] as const;

/** Race feats (02-races.md ลักษณะที่วาดเพิ่ม) and personal marks. A feat with a kind is written `name:kind` (wings:feather). */
export const FEAT_IDS = [
  // races
  'leafcrest', 'vines', 'webcrown', 'lavaglow', 'slit', 'runes', 'beadbeard', 'tusks', 'warpaint', 'scars', 'hairyfeet', 'rosycheeks',
  'fur', 'tail:fluffy', 'pawhands', 'beads', 'scales', 'hood', 'goldjewel', 'shedskin', 'horns', 'tail:lizard', 'fangs', 'tallcollar',
  'ledger', 'redeyes', 'wings:insect', 'sparkle', 'antenna', 'gel', 'swallowed', 'hairless', 'tail:spade', 'contract', 'gills', 'pearls',
  'finskirt', 'wet', 'wings:feather', 'sunstrap', 'goldcirclet', 'stone', 'moss', 'heavybrow', 'cracks', 'embers', 'flamehair',
  'glow-eyes', 'plates', 'rivets', 'steam', 'mecheye', 'mecharm', 'core', 'visor', 'seams', 'wraps', 'usekh', 'kohl', 'dust', 'gaunt',
  'claws', 'ribs', 'hunger', 'sunkeneyes',
  // people
  'scar', 'eyepatch', 'halo', 'tattoo', 'mask', 'bandage', 'blind', 'freckles', 'wings:scale', 'wings:night', 'missingarm',
  // added after the first set (feats-extra.ts): spirits, tentacles, one eye, a kappa's dish, face items
  'ghost', 'tentacles', 'cyclops', 'dish', 'glasses', 'monocle',
] as const;
