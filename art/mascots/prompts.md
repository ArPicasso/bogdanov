# Промпты Midjourney: проводники онбординга (ADR-011)

Логика, кто кого проводит, и тексты — в `docs/adr/011-club-mascot-guide.md`. У каждого блока кода на
GitHub есть кнопка «Скопировать».

## Как генерировать

**Один промпт — один талисман во всех четырёх позах.** Если рисовать позы отдельными промптами,
каждый раз выходит новый медведь. Внутри одной картинки Midjourney держит персонажа одинаковым, поэтому
промпт просит лист 2×2: один и тот же талисман четыре раза, в четырёх позах.

1. **Запустите промпт талисмана.** Midjourney даст четыре листа. Персонаж на них разный, но внутри
   каждого листа он один и тот же
2. **Выберите лист, где талисман нравится** и все четыре фигуры целиком, не касаются друг друга и
   краёв. Сделайте Upscale
3. **Одна поза не получилась** — не перезапускайте всё. Откройте лист в Editor, выделите эту фигуру
   через Vary Region, в поле промпта оставьте описание талисмана (начало промпта, до «Top left») и
   допишите строку позы из раздела «Починить одну позу». Остальные три фигуры не изменятся
4. **Сохраните лист** как `art/mascots/<клуб>.png`, например `ryazan-vdv.png`. Скрипт
   `tools/mascot_stickers.py` (ADR-011) разрежет его на четыре позы
5. **Позы стоят не на своих местах** — например, «машет» оказался внизу, или показывает влево.
   Перерисовывать не нужно: в `art/mascots/poses.json` у клуба записано, какая фигура листа идёт в
   какую позу, и `mirror`, если её надо отзеркалить: `{"polet": {"hello": "BL", "point": "TR mirror", …}}`

Порядок по умолчанию: слева вверху `hello` (машет), справа вверху `point` (показывает вниз — облачко тура
стоит над меню), слева внизу `cheer` (радуется), справа внизу `shrug` (разводит руками). Все смотрят
чуть вправо: в мини-аппе фигура стоит слева от облачка.

Параметры рассчитаны на Midjourney V7.

Если выходит не то:
- на листе разные персонажи — перезапустите; помогает поставить описание талисмана раньше слов про позы,
  как в промптах ниже;
- фигуры слиплись или обрезаны краем — перезапустите или добавьте `small figures, wide margins`;
- объём, тени, градиенты — `--stylize 0`, и проверьте, что стоит `--style raw`;
- логотип или надпись на майке — перегенерируйте или сотрите через Vary Region;
- нет белой каймы вокруг фигур — не страшно, скрипт вырежет и так.

## Починить одну позу

Для Vary Region: описание талисмана + строка позы. Под заголовком каждого талисмана указано, чем он машет:
paw — лапа, hand — рука, wing — крыло, fin — плавник, flipper — ласт.

| Поза | paw (лапа) |
| --- | --- |
| `hello` | `waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile` |
| `point` | `pointing down and to the right with one paw, helpful smile` |
| `cheer` | `jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout` |
| `shrug` | `shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face` |

Для остальных замените `paw` / `paws` на слово своего талисмана.

## Общие части

Промпты ниже уже собраны из этих частей. Они здесь, чтобы править стиль сразу во всех:

- **Стиль:** `flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background`
- **Запреты:** `--no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters`
- **Параметры:** `--ar 1:1 --v 7 --style raw --stylize 50`

Всего 26 листов, по одному на клуб. 19 уже нарисованы и порезаны, осталось 7 новых — первый раздел ниже.

## Новые: 7 листов

Персонажи для клубов без своего талисмана (ADR-011). Имени у них нет, в мини-аппе они говорят
«болею за», а не «я талисман».

### Ахмат-Гранит — Тур

`akhmat-granit` → `art/mascots/akhmat-granit.png` · по символам края: горы на эмблеме, кавказский тур · машет: hand

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly Caucasian mountain goat (tur) mascot with big curved ridged horns, short brown-grey fur, a small beard, sturdy build, wearing a blank black hockey jersey with emerald green trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Белгород — Лев

`belgorod` → `art/mascots/belgorod.png` · по символам края: лев с герба Белгорода · машет: paw

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a proud adult golden lion mascot with a big fluffy golden mane and a kind smile, wearing a blank royal blue hockey jersey with golden yellow trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Брянск — Лось

`bryansk` → `art/mascots/bryansk.png` · по символам края: брянский лес · машет: hand

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly moose mascot with big flat palmate antlers, long soft muzzle, warm brown fur, wearing a blank white hockey jersey with red trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Динамо-Карелия — Лайка

`dinamo-kareliya` → `art/mascots/dinamo-kareliya.png` · по символам края: карело-финская лайка · машет: paw

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a Karelian bear dog (laika) mascot with black and white fur, pointed upright ears and a curled bushy tail, wearing a blank royal blue hockey jersey with white trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Краснодар — Зубр

`krasnodar` → `art/mascots/krasnodar.png` · по символам края: зубры Кавказского заповедника · машет: hand

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly European bison mascot with a huge shaggy dark brown mane, short curved horns and a broad chest, wearing a blank dark green hockey jersey with black trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Протон — Протон

`proton` → `art/mascots/proton.png` · по символам края: город атомной станции · машет: hand

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a round cheerful proton particle mascot shaped like a bright blue ball with a friendly face, three thin glowing electron rings orbiting around it, small arms and legs, wearing a blank royal blue hockey jersey with light sky-blue trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Тверичи-СШОР — Сова

`tverichi` → `art/mascots/tverichi.png` · по символам края: крыло на эмблеме, спортивная школа · машет: wing

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a round snowy owl mascot with white and light blue feathers, big round yellow eyes and small ear tufts, wearing a blank light sky-blue hockey jersey with royal blue trim. Top left: waving hello with one raised wing, holding a hockey stick in the other wing, big friendly smile. Top right: pointing down and to the right with one wing, helpful smile. Bottom left: jumping for joy with both wings raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

## Перерисовать: слабые позы

Листы готовы, но эти фигуры не подходят к своей позе. Откройте лист в Editor, выделите фигуру через
Vary Region и вставьте промпт. Место на листе: TL — слева вверху, TR — справа вверху, BL — слева
внизу, BR — справа внизу. Сохраните лист под тем же именем и скажите — перережу.

Самару лучше перегенерировать целиком: Стриж вышел пингвином в скафандре. Промпт уже исправлен —
в разделе «Готовые».

**ryazan-vdv · TL → point** — по пояс и не показывает

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, pointing down and to the right with one paw, helpful smile, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**ryazan-vdv · TR → shrug** — по пояс и радуется, а нужна растерянность

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**ermak · TL → point** — с кинжалом; сейчас вместо point — отзеркаленное приветствие. После: в poses.json ermak point → "TL"

```
a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm, pointing down and to the right with one hand, helpful smile, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**tambov · BR → shrug** — смеётся и показывает вверх

```
a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes, shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**sokol · BR → shrug** — радуется, а нужна растерянность

```
a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim, shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**vityaz-podolsk · BL → cheer** — просто показывает вверх

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**vityaz-podolsk · BR → shrug** — тоже показывает вверх

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

**kaluga · BL → cheer** — без шлема, в остальных позах он в шлеме

```
a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim, jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout, flat 2D vector sticker, thick black outline, flat solid colors, thick white die-cut sticker border
```

## Готовые: 19 листов

Уже нарисованы и порезаны. Промпты — если лист захочется перегенерировать.

### Рязань-ВДВ — Мишка-десантник

`ryazan-vdv` → `art/mascots/ryazan-vdv.png` · талисман ХК «Рязань-ВДВ» · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Арктика — Белый

`arktika` → `art/mascots/arktika.png` · свой талисман · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a cute young polar bear cub mascot, white fur drawn as flat white shapes, small round ears, black button nose, wearing a blank navy blue hockey jersey with light sky-blue and thin red stripes on the sleeves. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Факел Ямал — Умка

`fakel-yamal` → `art/mascots/fakel-yamal.png` · свой талисман · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a big friendly polar bear mascot with creamy white fur drawn as flat shapes, broad chubby body, small round ears, black nose, wearing a blank navy blue hockey jersey with bright red sleeves and a red hem stripe. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Динамо-576 — Динамозавр

`dinamo-576` → `art/mascots/dinamo-576.png` · свой талисман · машет: hand · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly light-blue cartoon dinosaur mascot with a big round snout, two small rounded horns, a row of soft rounded spikes on the head and back, big round eyes, short tail, wearing a blank dark navy blue hockey jersey with white trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Ермак — Тимофеевич

`ermak` → `art/mascots/ermak.png` · свой талисман · машет: hand · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Прогресс — Рысь

`progress` → `art/mascots/progress.png` · свой талисман · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a slender lynx mascot with long black ear tufts, beige fur with small darker spots, white muzzle and fluffy cheek ruff, wearing a blank bright red hockey jersey with white trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Самара — Стриж

`samara` → `art/mascots/samara.png` · свой маскот · машет: wing · **перегенерировать**

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a slim swift bird mascot dressed as a cosmonaut, sleek dark navy blue head and back, long narrow sickle-shaped wings, deeply forked tail, tiny short black beak, white throat, white space suit, round open space helmet, small orange accents, clearly a swift and not a penguin. Top left: waving hello with one raised wing, holding a hockey stick in the other wing, big friendly smile. Top right: pointing down and to the right with one wing, helpful smile. Bottom left: jumping for joy with both wings raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Красная машина Академия — Крамси

`krasnaya-mashina` → `art/mascots/krasnaya-mashina.png` · талисман академии «Красная машина» · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a fluffy round red furry creature mascot with long upright rabbit-like ears, big shiny eyes and a wide happy smile, wearing a blank red hockey jersey with white trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Дизелист — Ласточка

`dizelist` → `art/mascots/dizelist.png` · талисман ХК «Дизель» · машет: wing · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a swallow bird mascot with a glossy black head and back, bright red face and throat, small yellow beak, white belly, long forked tail, wearing a blank black hockey jersey with bright yellow stripes. Top left: waving hello with one raised wing, holding a hockey stick in the other wing, big friendly smile. Top right: pointing down and to the right with one wing, helpful smile. Bottom left: jumping for joy with both wings raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Кристалл — Ёж

`kristall` → `art/mascots/kristall.png` · талисман ХК «Кристалл» · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a hedgehog mascot with spiky dark blue quills swept back like a mohawk, light beige face, black button nose, confident determined grin, wearing a blank navy blue hockey jersey with white and red trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Тамбов — Волк

`tambov` → `art/mascots/tambov.png` · талисман ХК «Тамбов» · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Металлург — Сева

`metallurg` → `art/mascots/metallurg.png` · талисман «Северстали» · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a lynx cub mascot with tan fur, dark stripes on the forehead and cheeks, black ear tufts, white muzzle, playful expression, wearing a blank bright yellow hockey jersey with black stripes. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### ЭкоНива-Бобров — Бобёр

`ekoniva-bobrov` → `art/mascots/ekoniva-bobrov.png` · персонаж с эмблемы · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a chubby brown beaver mascot with two big white front teeth, round ears, a flat dark brown paddle tail, wearing a blank green hockey jersey with white trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Полёт — Стерлядь

`polet` → `art/mascots/polet.png` · персонаж с эмблемы · машет: fin · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a sterlet sturgeon fish mascot standing upright on its tail fin, long pointed snout, grey-blue body with a row of bony plates along the back, small side fins used as hands, blue hockey helmet with a red stripe, wearing a blank blue hockey jersey with red trim. Top left: waving hello with one raised fin, holding a hockey stick in the other fin, big friendly smile. Top right: pointing down and to the right with one fin, helpful smile. Bottom left: jumping for joy with both fins raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both fins spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Ростов — Кондор

`rostov` → `art/mascots/rostov.png` · персонаж с эмблемы · машет: wing · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: an Andean condor mascot with sleek black feathers, a fluffy white neck ruff, small bald head, hooked beak, kind eyes, wearing a blank red hockey jersey with black trim. Top left: waving hello with one raised wing, holding a hockey stick in the other wing, big friendly smile. Top right: pointing down and to the right with one wing, helpful smile. Bottom left: jumping for joy with both wings raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Сокол — Сокол

`sokol` → `art/mascots/sokol.png` · персонаж с эмблемы · машет: wing · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim. Top left: waving hello with one raised wing, holding a hockey stick in the other wing, big friendly smile. Top right: pointing down and to the right with one wing, helpful smile. Bottom left: jumping for joy with both wings raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both wings spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Ленинградец — Нерпа

`leningradets` → `art/mascots/leningradets.png` · персонаж с эмблемы · машет: flipper · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a Ladoga ringed seal mascot standing upright, round silver-grey body with darker ring-shaped spots, round head with whiskers, big dark eyes, front flippers used as hands, wearing a blank navy blue hockey jersey with red trim. Top left: waving hello with one raised flipper, holding a hockey stick in the other flipper, big friendly smile. Top right: pointing down and to the right with one flipper, helpful smile. Bottom left: jumping for joy with both flippers raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both flippers spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Витязь-Подольск — Святогор

`vityaz-podolsk` → `art/mascots/vityaz-podolsk.png` · талисман ХК «Витязь» (КХЛ) · машет: hand · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim. Top left: waving hello with one raised hand, holding a hockey stick in the other hand, big friendly smile. Top right: pointing down and to the right with one hand, helpful smile. Bottom left: jumping for joy with both hands raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both hands spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```

### Калужские Ракеты — Рокет

`kaluga` → `art/mascots/kaluga.png` · талисман ХК «Калуга» (ВХЛ) · машет: paw · готов

```
character sheet of one single mascot drawn four times in a 2x2 grid, exactly the same character in every panel with identical face, body, colors and outfit: a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim. Top left: waving hello with one raised paw, holding a hockey stick in the other paw, big friendly smile. Top right: pointing down and to the right with one paw, helpful smile. Bottom left: jumping for joy with both paws raised high, hockey stick overhead, mouth open in a happy shout. Bottom right: shrugging with both paws spread out to the sides, head tilted, puzzled but friendly face. flat 2D vector sticker illustrations, all four figures full body and turned slightly to the right, simple bold rounded shapes, minimal details, thick black outline of even width around every shape, flat solid fill colors, simple dot eyes, cheerful and friendly, each figure with its own thick white die-cut sticker border, plenty of empty space between the figures, no panel borders, plain flat light gray background --no text, letters, numbers, logo, emblem, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, panel lines, different characters --ar 1:1 --v 7 --style raw --stylize 50
```
