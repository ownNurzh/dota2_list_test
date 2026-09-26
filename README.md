# DOTA қауым

Сайт нашей компании, которая каждый вечер собирается поиграть в Доту: знакомые ники, фирменные герои, байки из пати и «ещё по одной». Nuxt 4, Vue 3 и TypeScript, адаптивная раскладка для телефона и компьютера.

Сохранены все 31 игрок из исходного `index.html`, включая имена, MMR, тиры, заметки и теги. В исходных данных исправлены повторяющийся ID, опечатка в роли и названия героев.

Сайт: **https://ownnurzh.github.io/dota2_list_test/**

## Запуск

Нужен Node.js 22 или новее.

```sh
npm install
npm run dev
```

В Windows PowerShell при запрете запуска `npm.ps1` используйте `npm.cmd` вместо `npm`.

Откройте адрес, который выведет Nuxt (обычно `http://localhost:3000`).

```sh
npm run build       # production-сборка
npm run preview     # просмотр production-сборки
npm run generate    # статическая версия в .output/public
npm run typecheck   # проверка TypeScript
npm test           # данные, формула рейтинга, поиск и сортировка
npm run verify:static # проверка сгенерированных страниц и путей
```

## Структура

- `app/data/players.ts` — единственный источник данных игроков, характеристик и весов рейтинга.
- `app/utils/players.ts` — расчёт балла, поиск, сортировка, форматирование и пути изображений.
- `app/pages/index.vue` — каталог, рейтинг и избранное.
- `app/pages/players/[id].vue` — отдельная страница каждого игрока.
- `app/components/PlayerCard.vue`, `StatRadar.vue` — карточка и диаграмма навыков.
- `app/composables/useFavorites.ts` — избранное в localStorage, без регистрации.
- `app/assets/css/main.css` — общие стили и адаптивная раскладка.
- `public/images` — локальная заглушка на случай недоступности изображений. Арты героев загружаются с официального CDN Dota 2; права на персонажей принадлежат Valve.
- `legacy/index.html` — исходный одностраничный проект для справки.

## Данные и рейтинг

Чтобы добавить игрока, добавьте запись с уникальным `id` в `players.ts`. Профиль `/players/<id>` появится автоматически. Для нового героя добавьте сопоставление с именем файла на CDN в `getHeroSlug`.

Пять характеристик задаются вручную по шкале 0–100. Добавленные значения **демонстрационные**, они не получены из матчей или API. MMR и тиры сохранены из исходного списка и не являются живыми данными.

```text
Рейтинг = округление(
  механика × 0.25 + фарм × 0.20 + командная игра × 0.20
  + понимание игры × 0.25 + универсальность × 0.10
)
```

MMR не входит в формулу. Баллы, топ и карточки рассчитываются из одних и тех же данных. При равенстве балла порядок определяется MMR и ником. Избранное хранится только в текущем браузере. Шрифты Manrope и Unbounded загружаются из Google Fonts с системным запасным шрифтом.

## GitHub Pages

Публикацией управляет `.github/workflows/deploy-pages.yml`. Каждый push в `main` запускает установку через `npm ci`, тесты, проверку TypeScript и `npm run generate`. После проверки готовые файлы из `.output/public` публикуются в GitHub Pages. Workflow можно запустить вручную во вкладке Actions.

В настройках репозитория **Settings → Pages → Source** используется **GitHub Actions**. Base URL определяется из настроек Pages, поэтому ссылки, favicon и заглушки изображений работают в подпапке `/dota2_list_test/`. Все профили предварительно генерируются — прямые ссылки работают без Node.js-сервера.

Проверка такой же сборки локально в PowerShell:

```powershell
$env:NUXT_APP_BASE_URL = '/dota2_list_test/'
npm.cmd run generate
npm.cmd run verify:static
Remove-Item Env:NUXT_APP_BASE_URL
```

Сайт о своей компании остаётся доступен любому, у кого есть ссылка: GitHub Pages здесь не требует входа. Счётчики показывают весь состав из файла, а не присутствие онлайн.

Настройка соответствует [документации Nuxt для GitHub Pages](https://nuxt.com/deploy/github-pages) и [GitHub Pages с GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
