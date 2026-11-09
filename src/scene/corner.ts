// The corner icon of an event card (12-event-visuals "สีกรอบการ์ดตามหมวด", column ไอคอนมุม; M7 K5-24): a small pixel icon in the colour of the frame, drawn from a bitmap
// of 11 × 11 pixels. `#` is the colour of the frame, `+` a lighter touch of it, `.` is empty. The names are the words of the docs, so a card carries the word and this
// file turns it into a picture. Pure: Node tests read the bitmaps; the card draws them on a small canvas (EventCard.tsx).

export const ICON_SIZE = 11;

const rows = (s: string): string[] => s.trim().split('\n').map((r) => r.trim());

export const CORNER_ICONS: Record<string, string[]> = {
  // a dragon scale: a rounded shield with rows of ridges
  เกล็ด: rows(`
    ...#####...
    ..#+++###..
    .#+#####.#.
    .#+#...#.#.
    .#+#.#.#.#.
    .#+#...#.#.
    .#+#####.#.
    ..#+++###..
    ...#####...
    ....###....
    .....#.....`),
  // an eye
  ตา: rows(`
    ...........
    ...#####...
    ..#+++++#..
    .#++###++#.
    #++##+##++#
    #++#####++#
    #++##+##++#
    .#++###++#.
    ..#+++++#..
    ...#####...
    ...........`),
  // a flag on a pole
  ธง: rows(`
    .#.........
    .#######...
    .#+++++##..
    .#+++++###.
    .#+++++##..
    .#######...
    .#.........
    .#.........
    .#.........
    .#.........
    ###........`),
  // a cloud with a sun behind it
  ท้องฟ้า: rows(`
    ......#....
    ..#..###.#.
    ...#.#+#...
    ....#+++#..
    .###.###...
    #+++###.#..
    #++++++##..
    #++++++++#.
    #+++++++++#
    .#########.
    ...........`),
  // a crown of three points
  มงกุฎ: rows(`
    ...........
    #....#....#
    ##..###..##
    #+#.#+#.#+#
    #+###+###+#
    #+++++++++#
    #+++#+#+++#
    #+++++++++#
    ###########
    ...........
    ...........`),
  // a cog
  เฟือง: rows(`
    ....###....
    .#..#+#..#.
    .##.###.##.
    ..#######..
    ###+###+###
    #+#+...+#+#
    ###+###+###
    ..#######..
    .##.###.##.
    .#..#+#..#.
    ....###....`),
  // a leaf with a vein
  ใบไม้: rows(`
    ........###
    ......##+##
    ....##+++##
    ...#++++##.
    ..#+++#+#..
    .#++#+++#..
    .#+#+++#...
    #+#+++##...
    ##+++#.....
    #.##.......
    #..........`),
  // a sun: a disc with eight rays
  แสง: rows(`
    .....#.....
    .#...#...#.
    ..#..#..#..
    ...#####...
    ..#+++++#..
    ###+++++###
    ..#+++++#..
    ...#####...
    ..#..#..#..
    .#...#...#.
    .....#.....`),
  // an olive branch: a curved stem with leaves on both sides
  กิ่งมะกอก: rows(`
    ........##.
    .......#+#.
    ...#..##+#.
    ..#+#.#+#..
    ..#++##+#..
    ...###+#...
    ..#+##+#...
    .#+#.##....
    .##.#......
    ..#.#......
    ...#.......`),
  // the nine-pointed seal: a ring of nine points round a centre
  ตราเก้าแฉก: rows(`
    ....#.#....
    .#.#.#.#.#.
    ..#.....#..
    #.#..#..#.#
    ..#.###.#..
    #...#+#...#
    ..#.###.#..
    #.#..#..#.#
    ..#.....#..
    .#.#.#.#.#.
    ....#.#....`),
  // a rock
  หิน: rows(`
    ...........
    ....####...
    ..##++++##.
    .#+++++++#.
    .#+++###++#
    #+++##+++##
    #++++++####
    #+++++#####
    .##########
    ...........
    ...........`),
  // a lantern: a ring on top, a glass body with a flame, a base
  โคม: rows(`
    ....###....
    ....#.#....
    ...#####...
    ..#+++++#..
    ..#++#++#..
    ..#+###+#..
    ..#++#++#..
    ..#+++++#..
    ...#####...
    ....###....
    ...........`),
  // nine dots in a ring: the nine colours
  วงกลมเก้าสี: rows(`
    ....###....
    ..#.#+#.#..
    .#.......#.
    .#.......#.
    #+.......+#
    #+.......+#
    .#.......#.
    .#.......#.
    ..#.#+#.#..
    ....###....
    ...........`),
};

/** The icon bitmap for a word of the docs, or nothing (the card has no icon and shows none). */
export function cornerIcon(word: string): string[] | undefined {
  return CORNER_ICONS[word];
}

/** The pixels of an icon: [x, y, lit] of every filled cell, for the canvas that draws it. */
export function iconPixels(bits: readonly string[]): [number, number, boolean][] {
  const out: [number, number, boolean][] = [];
  bits.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#' || c === '+') out.push([x, y, c === '+']); }));
  return out;
}
