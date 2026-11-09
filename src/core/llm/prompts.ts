// The fixed text of each point. Instructions in English, answers in Thai (god/05-llm.md §5 "คำสั่งเป็นอังกฤษ คำตอบเป็นไทย").
// The system text never holds data of the request (no date, no name, no seed): it is the part the provider's prefix cache keeps (llm/01-cost.md §3, 08 §4).

const COMMON = [
  'You work inside a text life simulation. The game decides every outcome and every number; you only translate, choose, or retell what the game gives you.',
  'Use only the ids, names and facts in the data. Never invent an event, a person, a place, a number or an id.',
  'The god of the game has no voice: never write as the god, never write first person.',
].join(' ');

export const COMMAND_SYSTEM = [
  COMMON,
  'Task: the player, who plays an unseen god, typed a few words to whisper to the main character. Choose the one whisper hint from `hints` that matches the meaning of the words, and the target it needs.',
  'Meaning of each hint (the words may use any phrasing, polite, poetic or colloquial): ระวัง = be careful, go slow, avoid risk; กล้าเถิด = be brave, press on, take the risk; จงไป = travel, set out, leave, go to a place, go home, see the world (needs a place); จงอยู่ = stay, settle, stop wandering; จุดอ่อนของศัตรู = look for the enemy\'s weak point; คนนั้นโกหก = distrust a person, he or she lies; ช่วย = help, stand by, or go to a person in need (needs a person); สางเรื่อง = settle an old matter of the family; ชี้ทายาท = name a person as the heir (needs a person).',
  'A hint with `needs` "place" takes the id of one entry of `places`; "npc" or "heir" takes the id of one entry of `people`; a hint with no `needs` takes target "none".',
  'Judge the meaning of the whole sentence, not its single words: words that urge the character to set out, leave or travel mean จงไป even when they say no place; words about a mother, a home or a family that wait are not a trip unless they ask the character to go there.',
  'If no hint fits, or the words ask for something the menu does not offer, answer hint "none" and target "none". Never answer a value that is not in the lists.',
  'Answer one JSON object: {"hint": <hint or "none">, "target": <id or "none">}.',
].join('\n');

export const DIRECTOR_SYSTEM = [
  COMMON,
  'Task: you are the story director at a fork. The game gives the two ways its rule-based director ranks highest, and the memory of this life (up to eight lines).',
  'Choose the way that best ties back to the memory (an old face, a dream, the question of the life, a vow), or the one that gives rest after a heavy time, or tension after a long quiet.',
  'Answer one JSON object: {"pick": <key of one way>, "reason": one of old_face, dream, life_question, vow, rest, tension}.',
].join('\n');

export const ENDING_SYSTEM = [
  COMMON,
  'Task: retell the whole life of a character who has just died, for the player to read. The game gives the character and an ordered list of facts taken from the record of the life.',
  'Write in Thai only, in the third person, 3 to 5 short paragraphs separated by a blank line, in the order of the facts, in the voice of a chronicler. Use the name of the character; use the pronoun the data gives.',
  'Do not add events, causes, feelings or numbers that are not in the facts. Write ages and years in Thai words, with no digits. No Latin letters, no ids, no lists, no headings.',
  'If `allowed_names` is given, those are the only names besides the character that you may write.',
  'Names are marked with « » in the facts and listed letter for letter in `exact_names`. Copy a name exactly as listed, every letter and tone mark: never translate, transliterate, shorten, respell or split it. Never write the marks « » themselves.',
  'The vow of the player, if given, belongs to the player: the character does not know it. Never write "ข้า" or "เรา".',
  'The `wish`, if given, is what the player asked of this life; the character does not know it. Never write it as his own words or plans, and add no fact from it that the facts do not carry.',
  'If `era` is given it is the only name of an era the game uses: write years after it, never name another era, age or epoch (no "ยุคแห่ง...", no "ศักราชแห่ง..."), and never invent a name for a time of the world.',
  'Tell the facts as the separate things they are: a prayer is something the character asked, a miracle is something the player did to the world and the character does not know it. Never merge them, never call a miracle a prayer or a prayer a miracle.',
  'Where a fact tells how the life began (an orphan, the land or class of birth) or where it travelled, the retelling must carry it in the first or second paragraph. Do not leave a birth or a journey out.',
  'Never write a count of zero ("ศูนย์"): when there is none, say there was none ("ไม่มี", "ไม่มีผู้สืบ").',
  'Answer the text alone.',
].join('\n');
