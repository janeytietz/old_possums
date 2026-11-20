// The beasts you can have as your buddy, and the coats a cat can wear.
// Art-specific colours live in the art module; these lists are shared by the UI
// and the buddy-room protocol.

// The possum is everyone's first buddy. Other beasts are earned from bestiary
// cards (the cat is usually the first one found).
export const BEAST_LIST = [
  { id: 'possum', name: 'Old Possum', short: 'possum' },
  { id: 'cat', name: 'Scribe Cat', short: 'cat' },
];
export const BEAST_IDS = BEAST_LIST.map((b) => b.id);
export const beastName = (id) => BEAST_LIST.find((b) => b.id === id)?.name || 'Old Possum';
export const beastShort = (id) => BEAST_LIST.find((b) => b.id === id)?.short || 'possum';

export const COAT_LIST = [
  { id: 'ginger', name: 'Marmalade', swatch: '#d98c4e' },
  { id: 'tuxedo', name: 'Tuxedo', swatch: '#2e2b31' },
  { id: 'midnight', name: 'Midnight', swatch: '#1f1d23' },
  { id: 'silver', name: 'Silver tabby', swatch: '#aeaab1' },
  { id: 'calico', name: 'Calico', swatch: '#e9a35f' },
  { id: 'snow', name: 'Snowball', swatch: '#f2ede7' },
  { id: 'siamese', name: 'Siamese', swatch: '#5c4436' },
  { id: 'blue', name: 'Bluebell', swatch: '#7d8898' },
  { id: 'cocoa', name: 'Cocoa tabby', swatch: '#8d6b52' },
];

export const COAT_IDS = COAT_LIST.map((c) => c.id);
export const coatName = (id) => COAT_LIST.find((c) => c.id === id)?.name || 'Cat';

// Backdrops behind the scene. Parchment is the default; the starry vault is
// unlocked from a bestiary card.
export const BACKDROP_LIST = [
  { id: 'parchment', name: 'Parchment with vines' },
  { id: 'vault', name: 'The starry vault' },
];
export const BACKDROP_IDS = BACKDROP_LIST.map((b) => b.id);
