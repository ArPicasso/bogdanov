# Промпты Midjourney: проводники онбординга (ADR-011)

Файл собран для копирования: у каждого блока кода на GitHub есть кнопка «Скопировать». Логика, кто кого
проводит, и тексты — в `docs/adr/011-club-mascot-guide.md`.

## Как генерировать

1. **Стилевой референс — Кэп.** Загрузите в Midjourney `art/mascots/style-ref.png` (Кэп из `capSvg`,
   1024×1024 на сером фоне) и подставьте его ссылку вместо `STYLE_URL` во всех промптах. Так все
   талисманы выйдут плоскими наклейками с чёрным контуром и белой вырубкой — из одного альбома с
   Кэпом и стикерами бота
2. **Сначала `hello`.** Из четырёх вариантов берите тот, где: фигура целиком и по центру, ровный
   чёрный контур, белая кайма по силуэту, фон — сплошной серый, на майке нет букв и цифр. Upscale
3. **Остальные три позы — с `--oref`.** Ссылку на выбранный `hello` подставьте вместо `HELLO_URL`:
   так талисман останется тем же персонажем. Уплывает внешность — поднимите `--ow` до 200–300;
   поза не меняется, копируется `hello` — опустите до 60–80
4. **Сохраните** как `art/mascots/<клуб>-<поза>.png`, 1024×1024: `ryazan-vdv-hello.png`,
   `ryazan-vdv-point.png` и так далее. Дальше их режет `tools/mascot_stickers.py` (ADR-011)
5. **Фото настоящих костюмов не загружайте** — ни в `--oref`, ни в `--sref`. Описание словами —
   наш рисунок по мотивам, а не копия чужого костюма

Параметры рассчитаны на Midjourney V7. В другой версии проверьте, есть ли там `--oref`; если нет —
уберите его и добавьте в начало промпта ссылку на `hello` как картинку-подсказку.

Если выходит не то:
- объём, тени, градиенты — `--stylize 0`, и проверьте, что стоит `--style raw`;
- логотип или надпись на майке — перегенерируйте, `--no` не всегда срабатывает с первого раза;
- «малыш» или злой персонаж — добавьте в начало `adult proportions` или `gentle smile`;
- в персонажа пролезает пингвин (чёрно-белое тело, жёлтый клюв) — опустите `--sw` до 50.

## Общие части

Все промпты ниже уже собраны из этих частей. Они здесь, чтобы править стиль сразу во всех:

- **Стиль:** `flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background`
- **Запреты:** `--no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character`
- **Параметры:** `--ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150`, для поз кроме `hello` ещё `--oref HELLO_URL --ow 120`

Позы: `hello` — машет, `point` — показывает вниз, на меню (облачко тура стоит над меню), `cheer` —
радуется, `shrug` — разводит руками. Фигура повёрнута вправо: в мини-аппе она стоит слева от облачка.

Итого: 17 талисманов × 4 позы = 68 картинок. Ещё двое — «Витязь-Подольск» и «Калужские Ракеты» —
только после того, как клубы подтвердят связь (ADR-011).

## Рязань-ВДВ — Мишка-десантник

`ryazan-vdv` · талисман ХК «Рязань-ВДВ»

**hello** — Появление на экране выбора и знакомство

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a chubby brown bear mascot wearing a sky-blue paratrooper beret tilted to one side, a blue-and-white striped undershirt collar showing at the neck, round ears, big dark nose, wearing a blank dark navy blue hockey jersey with golden yellow trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Арктика — Белый

`arktika` · свой талисман

**hello** — Появление на экране выбора и знакомство

```
a cute young polar bear cub mascot, white fur drawn as flat white shapes, small round ears, black button nose, wearing a blank navy blue hockey jersey with light sky-blue and thin red stripes on the sleeves, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a cute young polar bear cub mascot, white fur drawn as flat white shapes, small round ears, black button nose, wearing a blank navy blue hockey jersey with light sky-blue and thin red stripes on the sleeves, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a cute young polar bear cub mascot, white fur drawn as flat white shapes, small round ears, black button nose, wearing a blank navy blue hockey jersey with light sky-blue and thin red stripes on the sleeves, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a cute young polar bear cub mascot, white fur drawn as flat white shapes, small round ears, black button nose, wearing a blank navy blue hockey jersey with light sky-blue and thin red stripes on the sleeves, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Факел Ямал — Умка

`fakel-yamal` · свой талисман

**hello** — Появление на экране выбора и знакомство

```
a big friendly polar bear mascot with creamy white fur drawn as flat shapes, broad chubby body, small round ears, black nose, wearing a blank navy blue hockey jersey with bright red sleeves and a red hem stripe, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a big friendly polar bear mascot with creamy white fur drawn as flat shapes, broad chubby body, small round ears, black nose, wearing a blank navy blue hockey jersey with bright red sleeves and a red hem stripe, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a big friendly polar bear mascot with creamy white fur drawn as flat shapes, broad chubby body, small round ears, black nose, wearing a blank navy blue hockey jersey with bright red sleeves and a red hem stripe, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a big friendly polar bear mascot with creamy white fur drawn as flat shapes, broad chubby body, small round ears, black nose, wearing a blank navy blue hockey jersey with bright red sleeves and a red hem stripe, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Динамо-576 — Динамозавр

`dinamo-576` · свой талисман

**hello** — Появление на экране выбора и знакомство

```
a friendly light-blue cartoon dinosaur mascot with a big round snout, two small rounded horns, a row of soft rounded spikes on the head and back, big round eyes, short tail, wearing a blank dark navy blue hockey jersey with white trim, waving hello with one raised hand, the other hand holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a friendly light-blue cartoon dinosaur mascot with a big round snout, two small rounded horns, a row of soft rounded spikes on the head and back, big round eyes, short tail, wearing a blank dark navy blue hockey jersey with white trim, pointing down and to the right with one hand, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a friendly light-blue cartoon dinosaur mascot with a big round snout, two small rounded horns, a row of soft rounded spikes on the head and back, big round eyes, short tail, wearing a blank dark navy blue hockey jersey with white trim, jumping for joy with both hands raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a friendly light-blue cartoon dinosaur mascot with a big round snout, two small rounded horns, a row of soft rounded spikes on the head and back, big round eyes, short tail, wearing a blank dark navy blue hockey jersey with white trim, shrugging with both hands spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Ермак — Тимофеевич

`ermak` · свой талисман

**hello** — Появление на экране выбора и знакомство

```
a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm, waving hello with one raised hand, the other hand holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm, pointing down and to the right with one hand, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm, jumping for joy with both hands raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a friendly Cossack ataman mascot from old Siberian tales, big bushy black moustache and short beard, rosy cheeks, tall pointed red fur-trimmed hat, long red kaftan with a wide belt, a round green-and-white shield with a swirl pattern on one arm, shrugging with both hands spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Прогресс — Рысь

`progress` · свой талисман

**hello** — Появление на экране выбора и знакомство

```
a slender lynx mascot with long black ear tufts, beige fur with small darker spots, white muzzle and fluffy cheek ruff, wearing a blank bright red hockey jersey with white trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a slender lynx mascot with long black ear tufts, beige fur with small darker spots, white muzzle and fluffy cheek ruff, wearing a blank bright red hockey jersey with white trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a slender lynx mascot with long black ear tufts, beige fur with small darker spots, white muzzle and fluffy cheek ruff, wearing a blank bright red hockey jersey with white trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a slender lynx mascot with long black ear tufts, beige fur with small darker spots, white muzzle and fluffy cheek ruff, wearing a blank bright red hockey jersey with white trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Самара — Стриж

`samara` · свой маскот

**hello** — Появление на экране выбора и знакомство

```
a swift bird mascot dressed as a cosmonaut, white space suit, dark navy blue wings and long forked tail, small sharp beak, round white space helmet open at the face, small orange accents on the suit, waving hello with one raised wing, the other wing holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a swift bird mascot dressed as a cosmonaut, white space suit, dark navy blue wings and long forked tail, small sharp beak, round white space helmet open at the face, small orange accents on the suit, pointing down and to the right with one wing, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a swift bird mascot dressed as a cosmonaut, white space suit, dark navy blue wings and long forked tail, small sharp beak, round white space helmet open at the face, small orange accents on the suit, jumping for joy with both wings raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a swift bird mascot dressed as a cosmonaut, white space suit, dark navy blue wings and long forked tail, small sharp beak, round white space helmet open at the face, small orange accents on the suit, shrugging with both wings spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Красная машина Академия — Крамси

`krasnaya-mashina` · талисман академии «Красная машина»

**hello** — Появление на экране выбора и знакомство

```
a fluffy round red furry creature mascot with long upright rabbit-like ears, big shiny eyes and a wide happy smile, wearing a blank red hockey jersey with white trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a fluffy round red furry creature mascot with long upright rabbit-like ears, big shiny eyes and a wide happy smile, wearing a blank red hockey jersey with white trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a fluffy round red furry creature mascot with long upright rabbit-like ears, big shiny eyes and a wide happy smile, wearing a blank red hockey jersey with white trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a fluffy round red furry creature mascot with long upright rabbit-like ears, big shiny eyes and a wide happy smile, wearing a blank red hockey jersey with white trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Дизелист — Ласточка

`dizelist` · талисман ХК «Дизель»

**hello** — Появление на экране выбора и знакомство

```
a swallow bird mascot with a glossy black head and back, bright red face and throat, small yellow beak, white belly, long forked tail, wearing a blank black hockey jersey with bright yellow stripes, waving hello with one raised wing, the other wing holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a swallow bird mascot with a glossy black head and back, bright red face and throat, small yellow beak, white belly, long forked tail, wearing a blank black hockey jersey with bright yellow stripes, pointing down and to the right with one wing, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a swallow bird mascot with a glossy black head and back, bright red face and throat, small yellow beak, white belly, long forked tail, wearing a blank black hockey jersey with bright yellow stripes, jumping for joy with both wings raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a swallow bird mascot with a glossy black head and back, bright red face and throat, small yellow beak, white belly, long forked tail, wearing a blank black hockey jersey with bright yellow stripes, shrugging with both wings spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Кристалл — Ёж

`kristall` · талисман ХК «Кристалл»

**hello** — Появление на экране выбора и знакомство

```
a hedgehog mascot with spiky dark blue quills swept back like a mohawk, light beige face, black button nose, confident determined grin, wearing a blank navy blue hockey jersey with white and red trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a hedgehog mascot with spiky dark blue quills swept back like a mohawk, light beige face, black button nose, confident determined grin, wearing a blank navy blue hockey jersey with white and red trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a hedgehog mascot with spiky dark blue quills swept back like a mohawk, light beige face, black button nose, confident determined grin, wearing a blank navy blue hockey jersey with white and red trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a hedgehog mascot with spiky dark blue quills swept back like a mohawk, light beige face, black button nose, confident determined grin, wearing a blank navy blue hockey jersey with white and red trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Тамбов — Волк

`tambov` · талисман ХК «Тамбов»

**hello** — Появление на экране выбора и знакомство

```
a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a grey-and-white wolf mascot with pointed ears, light grey muzzle, bushy tail, big friendly grin, wearing a blank black hockey jersey with silver-grey stripes, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Металлург — Сева

`metallurg` · талисман «Северстали»

**hello** — Появление на экране выбора и знакомство

```
a lynx cub mascot with tan fur, dark stripes on the forehead and cheeks, black ear tufts, white muzzle, playful expression, wearing a blank bright yellow hockey jersey with black stripes, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a lynx cub mascot with tan fur, dark stripes on the forehead and cheeks, black ear tufts, white muzzle, playful expression, wearing a blank bright yellow hockey jersey with black stripes, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a lynx cub mascot with tan fur, dark stripes on the forehead and cheeks, black ear tufts, white muzzle, playful expression, wearing a blank bright yellow hockey jersey with black stripes, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a lynx cub mascot with tan fur, dark stripes on the forehead and cheeks, black ear tufts, white muzzle, playful expression, wearing a blank bright yellow hockey jersey with black stripes, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## ЭкоНива-Бобров — Бобёр

`ekoniva-bobrov` · персонаж с эмблемы

**hello** — Появление на экране выбора и знакомство

```
a chubby brown beaver mascot with two big white front teeth, round ears, a flat dark brown paddle tail, wearing a blank green hockey jersey with white trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a chubby brown beaver mascot with two big white front teeth, round ears, a flat dark brown paddle tail, wearing a blank green hockey jersey with white trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a chubby brown beaver mascot with two big white front teeth, round ears, a flat dark brown paddle tail, wearing a blank green hockey jersey with white trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a chubby brown beaver mascot with two big white front teeth, round ears, a flat dark brown paddle tail, wearing a blank green hockey jersey with white trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Полёт — Стерлядь

`polet` · персонаж с эмблемы

**hello** — Появление на экране выбора и знакомство

```
a sterlet sturgeon fish mascot standing upright on its tail fin, long pointed snout, grey-blue body with a row of bony plates along the back, small side fins used as hands, blue hockey helmet with a red stripe, wearing a blank blue hockey jersey with red trim, waving hello with one raised fin, the other fin holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a sterlet sturgeon fish mascot standing upright on its tail fin, long pointed snout, grey-blue body with a row of bony plates along the back, small side fins used as hands, blue hockey helmet with a red stripe, wearing a blank blue hockey jersey with red trim, pointing down and to the right with one fin, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a sterlet sturgeon fish mascot standing upright on its tail fin, long pointed snout, grey-blue body with a row of bony plates along the back, small side fins used as hands, blue hockey helmet with a red stripe, wearing a blank blue hockey jersey with red trim, jumping for joy with both fins raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a sterlet sturgeon fish mascot standing upright on its tail fin, long pointed snout, grey-blue body with a row of bony plates along the back, small side fins used as hands, blue hockey helmet with a red stripe, wearing a blank blue hockey jersey with red trim, shrugging with both fins spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Ростов — Кондор

`rostov` · персонаж с эмблемы

**hello** — Появление на экране выбора и знакомство

```
an Andean condor mascot with sleek black feathers, a fluffy white neck ruff, small bald head, hooked beak, kind eyes, wearing a blank red hockey jersey with black trim, waving hello with one raised wing, the other wing holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
an Andean condor mascot with sleek black feathers, a fluffy white neck ruff, small bald head, hooked beak, kind eyes, wearing a blank red hockey jersey with black trim, pointing down and to the right with one wing, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
an Andean condor mascot with sleek black feathers, a fluffy white neck ruff, small bald head, hooked beak, kind eyes, wearing a blank red hockey jersey with black trim, jumping for joy with both wings raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
an Andean condor mascot with sleek black feathers, a fluffy white neck ruff, small bald head, hooked beak, kind eyes, wearing a blank red hockey jersey with black trim, shrugging with both wings spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Сокол — Сокол

`sokol` · персонаж с эмблемы

**hello** — Появление на экране выбора и знакомство

```
a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim, waving hello with one raised wing, the other wing holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim, pointing down and to the right with one wing, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim, jumping for joy with both wings raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a falcon mascot with red-brown and white feathers, yellow hooked beak, yellow feet, sharp but friendly eyes, wearing a blank red hockey jersey with white trim, shrugging with both wings spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Ленинградец — Нерпа

`leningradets` · персонаж с эмблемы

**hello** — Появление на экране выбора и знакомство

```
a Ladoga ringed seal mascot standing upright, round silver-grey body with darker ring-shaped spots, round head with whiskers, big dark eyes, front flippers used as hands, wearing a blank navy blue hockey jersey with red trim, waving hello with one raised flipper, the other flipper holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a Ladoga ringed seal mascot standing upright, round silver-grey body with darker ring-shaped spots, round head with whiskers, big dark eyes, front flippers used as hands, wearing a blank navy blue hockey jersey with red trim, pointing down and to the right with one flipper, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a Ladoga ringed seal mascot standing upright, round silver-grey body with darker ring-shaped spots, round head with whiskers, big dark eyes, front flippers used as hands, wearing a blank navy blue hockey jersey with red trim, jumping for joy with both flippers raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a Ladoga ringed seal mascot standing upright, round silver-grey body with darker ring-shaped spots, round head with whiskers, big dark eyes, front flippers used as hands, wearing a blank navy blue hockey jersey with red trim, shrugging with both flippers spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Витязь-Подольск — Святогор

`vityaz-podolsk` · талисман ХК «Витязь» (КХЛ) · **не генерировать, пока клуб не подтвердит связь**

**hello** — Появление на экране выбора и знакомство

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, waving hello with one raised hand, the other hand holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, pointing down and to the right with one hand, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, jumping for joy with both hands raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a friendly Russian bogatyr knight mascot, big dark beard, rosy cheeks, pointed steel helmet, chainmail sleeves, wearing a blank red hockey jersey with white trim, shrugging with both hands spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

## Калужские Ракеты — Рокет

`kaluga` · талисман ХК «Калуга» (ВХЛ) · **не генерировать, пока клуб не подтвердит связь**

**hello** — Появление на экране выбора и знакомство

```
a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim, waving hello with one raised paw, the other paw holding a hockey stick, big friendly smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150
```

**point** — Подсказки тура: показывает вниз, на меню

```
a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim, pointing down and to the right with one paw, looking at the viewer with a helpful smile, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**cheer** — Финал тура

```
a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim, jumping for joy with both paws raised high, holding a hockey stick overhead, mouth open in a happy shout, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```

**shrug** — «Не удалось загрузить»

```
a young lion cub mascot with golden fur and a small fluffy orange mane, a retro silver space-helmet visor pushed up on the forehead, wearing a blank navy blue hockey jersey with white trim, shrugging with both paws spread out to the sides, puzzled but friendly expression, head tilted, flat vector die-cut sticker, full body, three-quarter view turned slightly to the right, simple bold rounded shapes, thick uniform black outline, flat solid colors, simple dot eyes, cheerful and friendly, white sticker border around the silhouette, plain flat light gray background --no text, letters, numbers, logo, emblem, badge, watermark, gradient, shading, 3d, photo, realistic fur, background scene, floor shadow, second character --ar 1:1 --v 7 --style raw --stylize 50 --sref STYLE_URL --sw 150 --oref HELLO_URL --ow 120
```
