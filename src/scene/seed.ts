// A number from a text, to seed what varies by scene: the particles and the details of a painted place are made from the id of the scene, never from a random call.
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
