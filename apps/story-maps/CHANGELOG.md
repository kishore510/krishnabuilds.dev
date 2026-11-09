# Changelog

## 0.7.0

- New story map in Chronicles: The British Empire. From John Cabot's voyage in 1497 to the handover of Hong Kong in 1997, on a world map: 36 chapters, a Powers layer showing the British Empire gain and lose lands chapter by chapter alongside the dominions and the Spanish, Portuguese, Dutch and French empires (plus Germany, the Belgian Congo, the United States and Japan while they matter), and 17 people cards. It follows how colonies passed between empires: Jamaica, New York, Gibraltar, Canada, the Cape, Ceylon, Malta and the German colonies.

## 0.6.0

- Engine: world maps. A new `world` basemap (every continent, simplified from Natural Earth's public-domain coastlines), land shapes with holes for inland seas such as the Caspian, and a thinner coastal glow for wide maps.
- Engine: realms that change over time. A realm can be made of pieces, each shown only in the chapters it belongs to, plus dots for ports and islands too small to outline; its label can move as it changes. This lets an empire gain and lose lands chapter by chapter.
- Engine: a story can show only the current chapter's routes instead of the whole journey so far, and can set the language of its native-language names (no longer always Hindi).
- Art: new place glyphs: flag, treaty, anchor and chain.

## 0.5.1

- Company, Crown and Freedom: the 1947 map now shows Jammu and Kashmir as part of India, labelled on the map, with a Powers card on its accession to India on 26 October 1947. India's card notes when Kashmir, Junagadh and Hyderabad joined.

## 0.5.0

- Tap any place on the map, at any point in the story, to see every chapter that happens there or whose route starts or ends there, with each chapter's text and a link to jump to it. Places you haven't reached yet work too. Pins can also be reached with the keyboard (Tab, then Enter). Dragging the map from a pin doesn't open it.

## 0.4.0

- New story map in Chronicles: Company, Crown and Freedom. The East India Company's arrival in 1600, its conquest of India, Crown rule after 1857, and the struggle for independence to 15 August 1947: 32 chapters, a timeline from 1600 to 1947, routes (the first ships, Plassey, 1857, the Salt March, the INA, partition), a Powers layer and 24 people cards.
- Engine: People cards. A story can list people; each chapter shows who appears in it, and a person's card has their dates, role, a short life and links to every chapter they appear in.
- Engine: a third source tag, History, for stories from the historical record.
- Art: new place glyphs (trading post, fort, battle, crown, spinning wheel, salt, memorial) and travellers (ship, Company soldier, sepoy, marcher, INA soldier, refugees).
- Chronicles now covers empires and recorded history, not only the ancient world.

## 0.3.0

- Zoom and pan the map without zooming the page: pinch and drag on phones; scroll wheel or trackpad pinch, drag and double-click on laptops; and + and − buttons (or the + and − keys) everywhere. While you hold the camera the story leaves it alone; the next chapter or Whole map takes it back.

## 0.2.1

- Fix: on laptops and desktops, a kingdom's card now shows its dynasty, capital, role and ties, not just the ruler.
- Narrow phones: the story's "when" label stays on one line; the title shortens instead.

## 0.2.0

- First story map: Rama’s Journey (the Ramayana), 16 chapters with routes, a timeline, Play/Back/Next and a kingdoms layer.
- The engine (`engine/src`) draws any story from data: a basemap, the story's own `story.json` and the shared art library.
- Story Maps is live on the krishnabuilds.dev app list and in the site links.

## 0.1.0

- New app: hub page listing Legends, Chronicles and Deep Time, with eight stories marked coming soon.
- One placeholder page per story and a 404 page, each self-contained, in the painted theme (light and dark, following the shared `kb-theme` cookie).
- Yatra One and Tiro Devanagari Hindi self-hosted (Latin and Devanagari subsets).
- Deploys to story-maps.krishnabuilds.dev.
