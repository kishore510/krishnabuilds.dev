# Changelog

## 0.12.0

- New story map in Chronicles: Mesopotamia. From the pillars of Göbekli Tepe, about 9500 BCE, and the first farmers, through Uruk and the invention of writing, Sumer, Akkad, Ur, Hammurabi's Babylon, the Amarna letters and Assyria, to Nebuchadnezzar, Cyrus, the last cuneiform tablets, the rediscovery from the 1840s and the damage since 2003: 27 chapters, a Powers layer that changes chapter by chapter, and 19 people cards.
- New Near East map, from the Aegean to the Gulf of Oman, with the Tigris, Euphrates, Nile and Jordan, simplified from Natural Earth's public-domain coastlines, lakes and rivers. Egypt and Greece and Persia can use it too.
- Catalogue: the invention of cuneiform, the Sumerian city-states, the Akkadian Empire, the Third Dynasty of Ur, the First Dynasty of Babylon, Kassite Babylonia and the Neo-Assyrian and Neo-Babylonian empires, all linked to the new story.
- Art: new place glyphs (ziggurat, clay tablet, winged bull, gate) and a chariot traveller.

## 0.11.0

- New story map in Chronicles: The Indus Cities. From the first farmers at Mehrgarh, about 7000 BCE, through the planned cities of Mohenjo-daro, Harappa, Dholavira and Rakhigarhi, their seals and unread script, crafts and the sea trade with Mesopotamia, to the decline after about 1900 BCE and the rediscovery in the 1920s: 20 chapters on the South Asia map, an Extent layer that grows and shrinks with the civilisation, and 10 people cards for the archaeologists who found it.
- South Asia map: the Indus and the five rivers of the Punjab (Jhelum, Chenab, Ravi, Beas and Sutlej), which every story on this map now shows.
- Art: new place glyphs (brick city, seal, village, beads) and travellers (ox cart, reed boat).

## 0.10.0

- Every catalogue entry now has a summary: a short paragraph on what made it unique, its most iconic figures and its biggest achievements, shown on its entry page and used as the page description. Browse search covers summaries too.
- The build requires a summary of at most 60 words for every entry, so every new entry needs one.

## 0.9.0

- New hub: a **Timeline** of dynasties, empires and events, with time running down the page and regions as columns (India split into North & Gangetic, Deccan and Deep South). Scroll through time: a line marks the year, and the strip above lists who ruled at that moment. Four zoom levels, with region filters. Every name is readable; lanes with entries side by side get wider and scroll sideways.
- **Browse**: every entry as a card, with search, region and kind filters, "Story maps only", sorting, "Pick up where you left off" and "New".
- **Entry pages** at `/explore/<id>/` for every dynasty, event, legend and route in the new `catalogue.json`: dates, region, a slice of the timeline, its story map (or "to come"), before and after, and who ruled elsewhere at the same time.
- **Theme picker** in the top bar: Parchment (the cream theme), Night or Auto. It uses the shared `kb-theme` cookie, so the choice carries across krishnabuilds.dev.
- The catalogue's dates are approximate and still need checking against sources entry by entry.

## 0.8.0

- New story map in Chronicles: The Maurya Empire. From the Nandas of Magadha and Alexander at the Indus, through Chandragupta, Bindusara and Ashoka's Kalinga war, edicts and dhamma, to the last Maurya about 185 BCE and the rediscovery of Ashoka's inscriptions: 22 chapters on the South Asia map, a Powers layer that grows and shrinks with the empire, and 11 people cards. Chapters are tagged Archaeology, History or Tradition by their sources.
- Art: new place glyphs (Ashokan pillar, inscribed rock, stupa) and travellers (Greek soldier, war elephant, monk).

## 0.7.2

- Powers: small holdings (ports and islands) are now small solid markers with a light edge, not large dashed discs, so they no longer look like painted regions. The British Empire's Portuguese, Dutch, French and British ports in India now read as ports.
- World map: the green landscape washes are fainter and more olive, and the one over northern India is gone, so scenery no longer looks like a power's territory.

## 0.7.1

- The British Empire: British India (1858 to 1947) now includes the whole of Jammu and Kashmir at the top of the map, as maps of the time show it. The coastline data splits it along today's lines, which left the north cut off.

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
