-- Events test data
-- Generated from data/events.json
-- 9 events
-- Event type codes updated: BOOK_CLUB split into MANDARIN_BOOK_CLUB and ENGLISH_BOOK_CLUB

INSERT INTO events (
  id, slug, event_type_code, venue_id, title, title_en,
  description, description_en, event_date,
  registration_opens_at, registration_closes_at,
  cover_url, cover_url_en, is_published,
  created_at, updated_at
) VALUES
  (1, 'tw-2026-03', 'MANDARIN_BOOK_CLUB', 1, '台灣中文讀書會 2', 'Book Club in Taipei, Taiwan', '芭芭拉．德米克在《竹林姊妹》以雙胞胎芳芳與留在湖南的雙潔為線索，剖析一胎化時代的拐賣、官僚貪腐與國際收養的灰色產業，調查式敘事帶出政策如何撕裂家庭與身份。

作者不只還原被拐兒童的命運，也追蹤兩家人在文明與語言隔閡中重逢的複雜情感，場面既動人又充滿尷尬與不確定。

同時，作品討論了國際收養的道德困境與全球不平等，讓讀者在個人故事之外看見制度性的歷史脈絡與後果。', 'In Barbara Demick''s Daughters of the Bamboo Grove, twin sisters Fangfang and Shuangjie become the thread that reveals child trafficking under the one-child era, bureaucratic corruption, and the gray industry of international adoption.

Through investigative storytelling, Demick shows how policy can tear apart families and identities. She not only reconstructs the fate of trafficked children, but also follows two families through emotionally complex reunions shaped by civilizational and language barriers.

The book also confronts the moral dilemmas of international adoption and global inequality, helping readers see the systemic historical forces and consequences beyond any single personal story.', '2026-03-29T10:00:00.000Z', '2026-03-06T00:00:00.000Z', '2026-03-29T23:59:59.000Z', '/images/elements/poster_202603_taiwan.webp', NULL, TRUE, '2026-01-01T00:00:00.000Z', '2026-04-07T13:46:29.763Z'),
  (2, 'nl-2027-01', 'ENGLISH_BOOK_CLUB', 2, '英文讀書會', 'Book Club in the Netherlands', '荷蘭的面積比台灣略大 1.15 倍，說我們有點相像，卻又好像很不一樣。

這本書分別就轉型、社會、環境永續三個面向，討論荷蘭的光明與陰暗。荷蘭的職場、對待多元性別或許沒有比較平等，對待職業婦女也有自己的問題。也收錄一個較少被媒體報導的話題：荷蘭人深入骨子裡的運動文化。

讀完本書，你也會知道：原來大麻一直處在灰色地帶？「荷蘭病」會好嗎？荷蘭也會戰南北？還有紅燈區的種種歷史。', 'The Netherlands is only about 1.15 times the size of Taiwan. In some ways we feel alike, yet in many ways we are strikingly different.

Through three lenses, transition, society, and environmental sustainability, this book explores both the bright and shadowed sides of Dutch life. It questions workplace norms, gender diversity in practice, and the realities faced by working women. It also dives into a topic rarely covered by mainstream media: the deeply rooted sports culture in Dutch society.

After finishing this book, you will also learn why cannabis has long remained in a legal gray zone, whether the so-called Dutch disease can be cured, whether the Netherlands has its own north-south divide, and what histories lie behind the Red Light District.', '2027-01-15T14:00:00.000Z', '2027-01-01T00:00:00.000Z', '2027-01-31T23:59:59.000Z', '/images/elements/AD-15.webp', NULL, TRUE, '2026-01-01T00:00:00.000Z', '2026-04-06T12:38:37.623Z'),
  (3, 'online-2026-04', 'ENGLISH_BOOK_CLUB', 1, '英文讀書會', 'English Book Club', 'Good Material 是 Dolly Alderton 的幽默但溫柔的新作，從男主角 Andy 在三十五歲突遭分手的混亂出發，描繪他在友誼、約會與身分重整間的跌撞與自我修復。這本書從不同的角度看待男性視角，書中描繪主角的缺點、不安全感和人際關係。作者的機智筆觸與對三十多歲世代生活的敏銳觀察，並稱其既有笑點也有深刻情感轉折，也有出色的有聲書製作，整體來說是既輕鬆又能引人反思的一本分手小說，適合想找既療癒又帶笑的當代小說的讀者。

建議程度：中級至進階 (B2-C1)', 'Good Material is Dolly Alderton''s witty yet tender new novel. It begins with protagonist Andy''s sudden breakup at thirty-five and follows his stumbles through friendship, dating, and identity repair. Critics praise Alderton''s sharp humor and her keen observations of thirty-something life; the book delivers both laughs and emotionally resonant turns, and the audiobook production has also been well received. Overall, it''s a breezy yet thought-provoking breakup novel, perfect for readers who want something comforting, funny, and emotionally smart.

Recommended level: Intermediate to advanced (B2-C1)', '2026-04-11T13:00:00.000Z', '2026-03-06T00:00:00.000Z', '2026-04-11T23:59:59.000Z', '/images/elements/poster_202604_en_online.webp', NULL, TRUE, '2026-01-01T00:00:00.000Z', '2026-04-05T15:23:43.701Z'),
  (4, 'detox-2026-04', 'DETOX', 4, '數位排毒', 'Unplug Project', '勇者們，來自異世界的干擾太強大了！那些被稱為「螢幕」的神祕法器正在吸取我們的靈魂。大魔法師已下達禁令：進入本領地前，請將所有數位法器封印於「時空寶箱」中。

任務目標：擺脫數位心靈控制，重新連結你的隊友
冒險裝備：一支鉛筆、幾顆骰子，以及你無窮的想像力
客製角色：告訴我們你的角色的外觀、衣著、飾品、職業、有無魔法，我們會幫你 3D 列印出屬於自己的角色！
獎勵：專注力 +10、社交能力 +5、以及一段真正的傳奇回憶', 'Heroes, the interference from the Otherworld is too powerful. Those mysterious artifacts known as Screens are draining our very souls. The Archmage has issued a decree: before entering this realm, all digital artifacts must be sealed within the Space-Time Chest.

Quest Objective: Break free from digital mind control and reconnect with your party members.
Adventure Gear: A pencil, a few dice, and your boundless imagination.
Custom Characters: Describe your character''s appearance, clothing, accessories, class, and whether they possess magical powers. We will 3D print a unique miniature just for you.
Rewards: Focus +10, Social Skills +5, and a truly legendary memory.', '2026-04-26T10:00:00.000Z', '2026-03-06T00:00:00.000Z', '2026-04-26T23:59:59.000Z', '/images/elements/poster_202604_detox.jpg', NULL, TRUE, '2026-01-01T00:00:00.000Z', '2026-04-04T22:51:05.540Z'),
  (5, 'event-1775477435413', 'FAMILY_READING_CLUB', 1, '親子共讀會', 'Book Club in the Netherlands', '這本《郊遊日，一起去海底玩！》
以孩子最喜歡的恐龍為主角，結合海底冒險的情節，讓整個故事既有趣又充滿想像力。閱讀過程中，我感受到作者不只是描寫一段旅程，更細膩地帶入角色的情緒變化。當小恐龍們面對未知與困難時，會出現緊張、不安甚至害怕，但也透過彼此的陪伴與鼓勵，慢慢學會調整心情，勇敢面對挑戰。

故事中特別讓我印象深刻的是朋友之間的互動，在冒險中不只是期待與快樂，也包含誤會與挫折，但他們選擇溝通與合作，一起找到解決問題的方法。這樣的情節對孩子來說非常貼近生活，也能學習到如何面對情緒與人際關係。

整體而言，這本書不僅有吸引人的主題與畫面，更蘊含情緒管理與同理心的教育意義，是一本兼具趣味與成長價值的優質繪本唷🤍
', 'Book Club in the Netherlands', '2026-04-06T12:10:35.413Z', '2026-04-06T12:10:35.413Z', '2026-05-06T12:10:35.413Z', '/images/elements/AD-15.webp', '/images/elements/AD-15.webp', TRUE, '2026-04-06T12:16:06.613Z', '2026-04-06T12:23:51.971Z'),
  (6, 'event-1775478354561', 'DETOX', 2, '數位排毒', 'Digital detox', 'ofkcsfdv', 'fsvkfsmdvlcfm', '2026-04-06T12:25:54.561Z', '2026-04-06T12:25:54.561Z', '2026-05-06T12:25:54.561Z', '/images/elements/poster_202604_detox.jpg', '/images/elements/poster_202604_detox.jpg', TRUE, '2026-04-06T12:26:41.929Z', '2026-04-06T12:26:43.174Z'),
  (7, 'event-1775478462301', 'ENGLISH_BOOK_CLUB', 3, '線上英文讀書會', 'online Eng Book Club', 'ferevef', 'sfercsre', '2026-04-06T12:27:42.301Z', '2026-04-06T12:27:42.301Z', '2026-05-06T12:27:42.301Z', '/images/elements/poster_202604_en_online.webp', '/images/elements/poster_202604_en_online.webp', TRUE, '2026-04-06T12:28:18.403Z', '2026-04-06T12:34:34.255Z'),
  (8, 'event-1775479028885', 'MANDARIN_BOOK_CLUB', 2, '中文讀書會 2', '讀書會', '荷蘭讀書會', '荷蘭讀書會', '2026-04-06T12:37:08.885Z', '2026-04-06T12:37:08.885Z', '2026-05-06T12:37:08.885Z', '/images/elements/AD-15.webp', NULL, TRUE, '2026-04-06T12:37:29.930Z', '2026-04-07T13:46:17.520Z'),
  (9, 'event-1775479185015', 'MANDARIN_BOOK_CLUB', 1, '台灣中文讀書會', '台灣中文讀書會', '台灣中文讀書會', '台灣中文讀書會', '2026-04-06T12:39:45.015Z', '2026-04-06T12:39:45.015Z', '2026-05-06T12:39:45.015Z', '/images/elements/poster_202603_taiwan.webp', NULL, TRUE, '2026-04-06T12:40:01.208Z', '2026-04-07T13:46:19.987Z');

-- Use ON CONFLICT to update existing records
-- ON CONFLICT (id) DO UPDATE SET
--   slug = EXCLUDED.slug,
--   event_type_code = EXCLUDED.event_type_code,
--   title = EXCLUDED.title,
--   updated_at = EXCLUDED.updated_at;
