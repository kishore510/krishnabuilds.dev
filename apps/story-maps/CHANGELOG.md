# Changelog

## 0.31.1

- Fix: entries that share a story map no longer look like copies of it. The Bhagavad Gita, the Battle of the Ten Kings and 24 other entries are now shown as “Part of <story>” and open the story at their own chapter (for example the Ten Kings at chapter 9 of The Vedic Age) instead of at chapter 1. The build stops if a second entry links to a whole story or a chapter doesn’t exist.
- Fix: the Browse “New” row showed most of the catalogue, placeholders included, in catalogue order. It is now “New story maps”: the 8 most recently finished maps from the last 45 days, newest first, from a new `added` time on each built story in `manifest.json`. Placeholder entries never show as New.
- The Early Tamil kingdoms entry is now The Three Crowned Kings (early Tamil kingdoms), matching its story map.

## 0.31.0

- New story map in Chronicles: The Delhi Sultanate. From the raids out of Ghazni and the battles of Tarain, through Muinuddin Chishti at Ajmer, the Qutb Minar, Bakhtiyar Khalji in Bihar and Bengal, Aibak at Lahore, Chinggis Khan on the Indus, Iltutmish and Razia, Balban and the Mongol frontier, Alauddin Khalji (Devagiri, Gujarat and Malik Kafur, the Mongols at Delhi, Ranthambore and Chittor, the fixed markets, Warangal and the far south), the Tughlaqs (‘Delhi is still far’, Daulatabad, the token coins, Ibn Battuta, the breakaway of Madurai, Vijayanagara, Bengal and the Bahmanis, Firuz Shah and Ashoka’s pillars), Timur’s sack of Delhi, the regional sultanates and the Sayyids, the Lodis at Jaunpur and Agra, Kabir and Guru Nanak, to Panipat in 1526 and the sultanate’s legacy: 30 chapters, a Powers layer that changes chapter by chapter, and 23 people cards.
- Catalogue: the Delhi Sultanate entry now opens the story.

## 0.30.0

- New story map in Chronicles: The Mughal Empire. From Babur’s boyhood in Ferghana, Samarkand won and lost and the kingdom at Kabul, through the first battle of Panipat, Khanwa and Babur’s gardens, Humayun’s defeats by Sher Khan, Sher Shah’s roads and rupee, Akbar’s birth at Umarkot and Humayun’s fall on the library stairs, Akbar’s reign (Hemu and the second Panipat, the Amber alliance, Chittor, the ride to Gujarat, Haldighati, Fatehpur Sikri, the House of Worship, Todar Mal and the Ain-i Akbari, Chand Bibi, Prince Salim’s revolt), Guru Arjan, Sir Thomas Roe and Nur Jahan, the gardens of Kashmir, the Taj Mahal and Shahjahanabad, the war of succession, Shivaji, Aurangzeb’s stricter rule, the Khalsa, Golconda and the plain grave at Khuldabad, to the successor states, Nadir Shah, the third Panipat, Shah Alam II, 1857 and the exile of Bahadur Shah Zafar, and the Mughal legacy: 39 chapters, a Powers layer that changes chapter by chapter, and 24 people cards.
- Catalogue: the Mughal Empire and the First Battle of Panipat entries now open the story.
- Art: a Mughal dome glyph and a four-part garden (char bagh) glyph.

## 0.29.0

- A guided tour for first-time visitors. On a first visit the hub and the first story opened each show a short tour: a few cards that light up one part of the page at a time (the story cards, Atlas, Timeline and Browse on the hub; the chapter buttons, the chapter card, the map, the timeline and the chapter list on a story). It can be skipped at any point, and Escape closes it.
- The tour can be taken again at any time: “How it works” beside the hub’s heading, and a “?” button on every story’s map, under the zoom buttons.
- It opens by itself only once per device for the hub and once for stories, and not on a story for someone who has already read chapters here. It lives in `hub/tour.js`; the engine is unchanged and still stores nothing.

## 0.28.0

- New story map in Chronicles: Greece and Persia, the Greek city-states and the Persian empire, and where they met. From the games at Olympia, Delphi and the colonies and the thinkers of Miletus, through Cyrus and the Medes, Croesus at Sardis, Babylon and Egypt, Darius at Behistun, Persepolis, the Royal Road, Scylax down the Indus and the bridge over the Bosporus, Athens’ democracy, the Ionian Revolt, Marathon, the silver of Laurion, Xerxes at the Hellespont, Thermopylae, Salamis, Plataea and Mycale, the Delian League, the Parthenon, Persian gold and Sparta’s victory, the Ten Thousand and Mausolus, to Philip of Macedon, Alexander at the Granicus, Issus and Gaugamela, the burning of Persepolis, the last Achaemenid, the weddings at Susa and Alexander’s death in Babylon, then the first marathon in 1896 and the digging of Persepolis: 34 chapters, a Powers layer that changes chapter by chapter, and 19 people cards.
- Engine: a story can set its own whole-map view (`overview`); otherwise it uses its basemap’s.
- Near East map: widened west to take in mainland Greece (the projection and size change together, so the other stories frame the same), with the Aegean Sea named, the Pindus mountains and forest in Macedonia.
- Catalogue: Classical Greece, Achaemenid Persia and Alexander’s empire now open the story.
- Art: a Greek temple glyph, and a trireme as a traveller.

## 0.27.0

- New story map in Legends: The Churning of the Ocean (Samudra Manthan), the fourth of the Indian legends. From the story Vishvamitra tells Rama at Vishala, Durvasa’s garland and the gods’ defeat, through Vishnu’s plan and the truce with Bali, Mandara uprooted and flown to the sea on Garuda, Vasuki as the rope, the tortoise (Kurma) and his temple at Srikurmam, the poison and Shiva’s blue throat (Kailasa, Neelkanth, Surutapalli), the treasures (Kamadhenu, the white horse, Airavata, the Kaustubha jewel, the coral tree, the apsaras, Lakshmi, Varuni, Dhanvantari), the pot snatched, Mohini, Rahu and the eclipses, and the war on the shore, to the coral tree at Dwaraka, the four drops of nectar and the Kumbh Mela towns (Haridwar, Prayagraj, Ujjain, Nashik), Harsha at Prayag in Xuanzang’s account and the Kumbh Mela today: 32 chapters and 10 people cards.
- The ocean of milk is set in the Bay of Bengal only so the churning has a place on the map; the story’s note says so.
- Catalogue: the Churning of the Ocean entry now opens the story.
- Art: glyphs for the churning, a tortoise and a pot (kumbha), and a pot of nectar as a traveller.

## 0.26.0

- New story map in Legends: The Life of Krishna, the third of the Indian legends. From the voice at Devaki’s wedding, the birth in Kamsa’s prison and Vasudeva’s crossing of the Yamuna, through Gokula (Putana, the butter thief, the mortar) and Vrindavan (Kaliya, Govardhan, the rasa dance, Radha in later tradition), Akrura’s chariot, the end of Kamsa, Sandipani at Avanti, Uddhava and the song of the bee, Jarasandha’s sieges, Dwaraka in the sea, Rukmini, the Syamantaka jewel, Naraka, Usha and Aniruddha, the schoolfriend’s flattened rice, the Pandava chapters (Subhadra, the Khandava forest, Jarasandha, Shishupala, the peace mission, the Gita, the charioteer’s war, Gandhari’s curse), to the iron club, the Uddhava Gita, the hunter’s arrow at Prabhasa and the sea taking Dwaraka, then the historical record (Heliodorus at Vidisha, the Gita Govinda, Vrindavan rediscovered): 37 chapters, a Kingdoms layer and 14 people cards.
- Catalogue: the Life of Krishna entry now opens the story; a new legend entry, the Bhagavata Purana, links to it.
- Art: a flute glyph, and Garuda and a basket-bearer as travellers.

## 0.25.0

- New story map in Chronicles: The Gupta Empire. From a divided north about 300 CE and Chandragupta I’s Licchavi marriage, through Samudragupta (Harishena’s poem on the Prayagraj pillar, the Naga kings uprooted, the southern campaign to Kanchi, tribute from the frontiers, Meghavarna’s monastery at Bodh Gaya, the horse sacrifice and lyre coins), Chandragupta II (Ramagupta and Dhruvadevi, the end of the Western Kshatrapas, the boar at Udayagiri, Prabhavatigupta among the Vakatakas, Faxian, the iron pillar, Kalidasa), Kumaragupta and Nalanda, the Mandsaur silk weavers, Skandagupta against the Hunas and the Sudarshana lake, to the Sarnath Buddhas, the Damodarpur land sales, Eran under Toramana, Aryabhata, the Deogarh temple, Goparaja’s memorial, Mihirakula, Yashodharman, the last Guptas and the “golden age” question: 30 chapters, a Powers layer that changes chapter by chapter, and 15 people cards.
- Catalogue: the Gupta Empire entry now opens the story.

## 0.24.0

- New story map in Chronicles: The Satavahanas, the Deccan dynasty that followed the Mauryas in the south. From Ashoka’s edicts in the Deccan, Simuka’s coins at Kotilingala, Queen Naganika at Naneghat, Kharavela’s challenge, the Sanchi gateway and the first caves at Ajanta, through the great hall at Karla, Hala’s Seven Hundred Verses, the Periplus on Kalyan, Paithan and Tagara, Roman bronzes at Kolhapur and Nahapana’s Kshatrapas, to Gautamiputra’s revival (the Jogalthembi hoard, Gautami Balashri’s inscription), Ptolemy’s two royal seats, Rudradaman at Junagadh, the marriage recorded at Kanheri, coins in two languages, Amaravati, the portraits at Kanaganahalli, Yajna Sri’s ship coins, the break-up about 225 CE and the Shalivahana era: 23 chapters, a Powers layer that changes chapter by chapter, and 11 people cards.
- Catalogue: the Satavahana dynasty entry now opens the story.

## 0.23.0

- New story map in Legends: The Mahabharata, the second of the Indian legends. From Vyasa and Ganesha at Mana, Shantanu and Ganga, Bhishma's vow, the princesses of Kashi and Karna set adrift to Champa, through the rival cousins (Drona's tournament, Ahichchhatra, the house of lac at Varanavata, Hidimba and Baka, Draupadi's choice at Kampilya), Indraprastha (the Khandava forest, Arjuna in Manipura and Dwaraka, Jarasandha, the royal consecration), the dice game and Draupadi in the hall, the exile (Kamyaka, Bhima and Hanuman, the yaksha's questions, the year in hiding at Virata's city), Krishna's peace mission and Karna's choice, the eighteen days at Kurukshetra from the Bhagavad Gita to the night raid, to Bhishma's teachings, the horse sacrifice, the end of the Yadavas at Prabhasa, the sea taking Dwaraka, the great journey and the critical edition: 39 chapters, a Kingdoms layer and 16 people cards.
- Catalogue: the Mahabharata entry now opens the story; a new legend entry, the Bhagavad Gita, links to it.
- Art: a burning-house glyph, for the house of lac.

## 0.22.0

- New story map in Chronicles: The Chola Empire, following The Three Crowned Kings. From Vijayalaya's capture of Thanjavur about 848, Aditya's defeat of the Pallavas, Parantaka's Madurai, the Uttaramerur elections, Takkolam and Sembiyan Mahadevi, through Rajaraja I (Kandalur Salai, Sri Lanka, Vengi, the Maldives, the great temple at Thanjavur, the land survey, the Chudamani Vihara) and Rajendra I (all of Sri Lanka, the march to the Ganges, Gangaikonda Cholapuram, the raid on Srivijaya, the embassies to China, Koppam), the Chalukya Cholas (Vijayabahu, Kulottunga I, the Kalingattupparani, Sekkizhar and Kamban, Kulottunga III), to the Pandya revival and the last Chola in 1279, and the bronzes, merchant guilds and living temples: 29 chapters, a Powers layer that changes chapter by chapter, and 14 people cards.
- Catalogue: the Chola Empire entry now opens the story.
- Art: a temple tower (vimana) glyph.

## 0.21.0

- New story map in Chronicles: The Three Crowned Kings, the early Tamil kingdoms of the Cheras, Cholas and Pandyas. From the urn burials of Adichanallur and the brick town at Keezhadi, through the south as others saw it (Megasthenes’ Pandaia, Ashoka’s second rock edict, the first Tamil-Brahmi inscriptions at Mangulam, Elara in Anuradhapura, Kharavela’s league of Tamil states), the Sangam age (the assemblies of poets, the poems of love and war, the Cheras of Vanci, Karikala at Venni, Puhar, Nedunjeliyan at Talaiyalanganam, Avvaiyar and Athiyaman), the pepper and pearl trade with Rome (Muziris, Pliny, the Muziris papyrus, Arikamedu, Korkai), to the Tale of the Anklet, Puhar lost to the sea, the Kalabhra interval and the printing of the poems by Damodaram Pillai and Swaminatha Iyer: 24 chapters, a Powers layer and 12 people cards.
- Catalogue: the Early Tamil kingdoms entry now opens the story.
- Art: a palm-leaf manuscript glyph and a merchant ship traveller.

## 0.20.0

- New story map in Chronicles: The Maya. From Aguada Fénix, the oldest Maya monument, El Mirador, the San Bartolo murals and highland Kaminaljuyu, through the Classic kingdoms (Tikal's first dated stela, the arrival of Sihyaj K'ahk' in 378, Copán's founder, Tikal's defeat in 562, Calakmul and the Snake kingdom, Pakal of Palenque, Dos Pilas, Lady Six Sky of Naranjo, Tikal's victory of 695, the Yaxchilan lintels, the beheading of 18 Rabbit, Copán's Hieroglyphic Stairway and the Bonampak murals), the southern collapse and the last Long Count date in 909, to Uxmal, Chichen Itza, Mayapan, Tulum, the K'iche' and the Popol Vuh, Columbus's trading canoe, the Spanish conquest from Champotón to the burning of the books at Maní and the fall of Nojpetén in 1697, and what remains: Stephens and Catherwood, the Caste War, the decipherment, the 2018 lidar survey and the Maya today. 35 chapters, a Powers layer that changes chapter by chapter, and 18 people cards.
- Mesoamerica map: Lake Petén Itzá, drawn by hand around the island of Nojpetén (Flores).
- Catalogue: the Maya civilisation now opens the story; new entries for the fall of Nojpetén (an event) and, in legends, the Popol Vuh.
- Art: new place glyphs (a Maya temple with a roof comb, a ballcourt) and travellers (a Maya warrior and a trading canoe).

## 0.19.0

- New story map in Chronicles: The Aztec Empire, the first in the Americas. From the migration out of Aztlan, the Seven Caves and Serpent Hill, through Chapultepec, Culhuacan and the eagle on the cactus (Tenochtitlan, by tradition 1325), the Tepanecs, the chinampas and Teotihuacan, the Triple Alliance of 1428 (Itzcoatl, Nezahualcoyotl, Moctezuma I, the flowery wars, the Purépecha, the Great Temple, Soconusco and the empire of tribute), to the Spanish conquest from Cozumel and Malintzin to Cholula, the Sad Night, smallpox and the fall of Tenochtitlan in 1521, and what remains: 34 chapters, a Powers layer that changes chapter by chapter, and 15 people cards.
- New Mesoamerica map, from Sinaloa and the Gulf of Mexico to Honduras and western Cuba, simplified from Natural Earth’s public-domain coastlines, lakes and rivers, with the lakes of the Valley of Mexico about 1519 and Lake Pátzcuaro drawn by hand. Stories of the Maya can use it too.
- Catalogue: the Aztec Empire and the Fall of Tenochtitlan now open the story; new entries for the Toltecs (Tula) and, in legends, the eagle on the cactus.
- Art: new place glyphs (stepped temple, eagle on a cactus, painted book) and travellers (a Mexica walker with the god’s bundle, an eagle warrior and a conquistador).

## 0.18.0

- New story map in Chronicles: The Nanda Dynasty. The rise of Magadha from Bimbisara’s hill-ringed Rajagriha, Anga, Ajatashatru’s war with the Vajjis and the fort at Pataligrama, Shishunaga’s victory over Avanti and the council at Vaishali, through the Nanda kings (the barber’s-son stories, Mahapadma the sole ruler, Kalinga in Kharavela’s inscription, the army the Greeks feared, the Nanda treasure and the court legends), Alexander’s halt at the Beas, to Chanakya’s vow, the fall of the Nandas about 322 BCE, Mudrarakshasa, Magadha’s nameless coins and what the Mauryas inherited: 21 chapters, a Powers layer that changes chapter by chapter, and 13 people cards.
- Catalogue: the Nanda dynasty entry now opens the story.

## 0.17.0

- New story map in Chronicles: The Vedic Age. From the Indo-European roots of Vedic Sanskrit, the Sinauli carts and the Mitanni treaty's Vedic gods, through the Rigveda's land of seven rivers (fire and soma, Indra, Vishvamitra and the rivers, the Battle of the Ten Kings, the Sarasvati), the Kuru kingdom, the four Vedas, Painted Grey Ware, iron, varna and the horse sacrifice, the fire carried east to Videha, Janaka's court and the Upanishads, to the sixteen great kingdoms, the Buddha and Mahavira, Sayana's commentary, Max Müller's printed Rigveda and the 1975 agnicayana at Panjal: 26 chapters, a Lands layer that changes chapter by chapter, and 12 people cards.
- Catalogue: the Vedic period now opens the story, and a new legend entry, the Battle of the Ten Kings, links to it.

## 0.16.0

- New story map in Chronicles: Pharaonic Egypt. From the standing stones of Nabta Playa, about 5000 BCE, and the first writing at Abydos, through the unification, the pyramids of Saqqara and Giza and the town that fed their builders, the Middle Kingdom's Nubian forts and the first alphabet, the Hyksos, Hatshepsut, Megiddo, Amarna, Kadesh and Abu Simbel, to Kush, Persia, Alexander, the Ptolemies and the last hieroglyphs at Philae, and the rediscovery from the Rosetta Stone to the Grand Egyptian Museum: 29 chapters, a Powers layer that changes chapter by chapter, and 17 people cards.
- Near East map: the Nile now runs south through Nubia to the map's edge, with its Rosetta and Damietta branches through the delta, from Natural Earth 1:10m rivers. Mesopotamia shows them too.
- Catalogue: new events for the Great Pyramid of Giza and the Battle of Kadesh, in the Egypt lane; the Pharaonic Egypt and Ptolemaic Egypt entries, which already named it, now open the story instead of "to come".
- Art: new place glyphs (pyramid, temple gateway, sun disc, lighthouse, stela).

## 0.15.0

- New story map in Chronicles: The Vijayanagara Empire. From Delhi's raid on Kampili in 1327 and the founding of the city of victory on the Tungabhadra, through the Bahmani wars, Madurai, Abdur Razzaq's visit and Krishnadevaraya's reign (Goa's horse trade, the Kalinga campaigns, Raichur, the court poets and Hampi's temples), to Talikota and the sack of 1565, the last capitals at Penukonda, Chandragiri and Vellore, the Madras grant of 1639 and the ruins' rediscovery: 24 chapters, a Powers layer that changes chapter by chapter, and 15 people cards.
- South Asia map: the Krishna, Tungabhadra and Kaveri rivers, which every story on this map now shows.
- Catalogue: the Vijayanagara Empire, the Bahmani Sultanate and the Battle of Talikota link to the new story.
- Art: a temple gateway tower (gopuram) glyph and a horse traveller.

## 0.14.0

- New **Atlas** on the hub, and the first thing you see: a world map and a year. Drag the year (or press play) and every civilisation and empire alive then appears as a circle on its heartland; tap one for its summary, its story map, and what came next in the same place. Circles mark a heartland and a rough reach, never a border. The atlas and the timeline share one year, so switching tabs keeps your place in time.
- Hub: a **Start with a story** row, one card per story map with a small map of where it happens. A story you have started shows how far you got and opens where you left off.
- Stories: the whole card is now readable without opening the sheet, the chapter buttons sit at the bottom under your thumb with Next as the main one, and on a phone you can swipe the card sideways to turn the page.
- Stories: the numbered chapter circles are replaced by a chapter list with titles and dates under each phase; open it from the chapter count on the map.
- Stories: dragging the timeline shows which chapter is under your finger.
- Stories: the chapter is in the address (`/maurya/#12`), so a chapter can be shared and a reload stays put, and a story offers to continue from the chapter you stopped at.
- Stories: the last chapter leads on to another story and to the catalogue entries around it, and a card that mentions another story map links to it.
- Stories: the layer button says what it does (Show powers, Hide powers), and the back arrow returns to wherever you came from.
- Catalogue: every civilisation and dynasty has `at` and `radius` for the atlas; entry pages have a Show on the atlas button.

## 0.13.0

- New story map in Chronicles: Mesopotamia. From the pillars of Göbekli Tepe, about 9500 BCE, and the first farmers, through Uruk and the invention of writing, Sumer, Akkad, Ur, Hammurabi's Babylon, the Amarna letters and Assyria, to Nebuchadnezzar, Cyrus, the last cuneiform tablets, the rediscovery from the 1840s and the damage since 2003: 27 chapters, a Powers layer that changes chapter by chapter, and 19 people cards.
- New Near East map, from the Aegean to the Gulf of Oman, with the Tigris, Euphrates, Nile and Jordan, simplified from Natural Earth's public-domain coastlines, lakes and rivers. Egypt and Greece and Persia can use it too.
- Catalogue: new entries for the invention of cuneiform, the Third Dynasty of Ur and Kassite Babylonia, in the Mesopotamia lane; Sumer, Akkad, the Old Babylonian kingdom, the Neo-Assyrian and the Neo-Babylonian empires now link to the new story.
- Art: new place glyphs (ziggurat, clay tablet, winged bull, gate) and a chariot traveller.

## 0.12.0

- Browse: a new **Civilisations** filter, alongside Dynasties & empires, Epics & legends, Events and Routes. The Indus, Pharaonic Egypt and classical Greece are now civilisations; civilisations sit on the timeline with the dynasties.
- New region: **The Americas** (Mesoamerica, Andes, North America): Olmec, Maya, Teotihuacan, the Aztec Empire, Chavín, Moche, Tiwanaku, the Inca Empire and the Mississippian culture, with the fall of Tenochtitlan and Pizarro's capture of Atahualpa.
- European empires overseas get their own lanes: the Spanish, Portuguese, French and Dutch empires join the British Empire, with Columbus in 1492 and Vasco da Gama in 1498.
- 59 new entries in all, filling gaps across the timeline: the Vedic period and the Mahajanapadas, the Sikh Empire, the Ahoms, the Eastern Gangas and Mysore under Hyder Ali and Tipu Sultan; Minoan Crete, Mycenaean Greece, Alexander's empire, Carthage, the Vikings, Napoleon, Kievan Rus', Muscovy and the Russian Empire; Sumer, Akkad, Babylon, the Hittites, Assyria, the Seleucids, Parthians, Rashidun and Umayyad caliphates and the Safavids; Kush, Ghana, Great Zimbabwe and Songhai; the Mongols and Timurids, Silla, Goryeo, Joseon, Heian, Kamakura, Ashikaga and Tokugawa Japan, Srivijaya, the Khmer Empire and Majapahit.
- East Asia is now East & Southeast Asia. As before, the dates are approximate and still need checking against sources.

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
