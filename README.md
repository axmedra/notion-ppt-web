# Notion → PPTX Web Service

Веб-сервис для экспорта записей из Notion базы данных в презентацию PowerPoint.

## Описание

Сервис позволяет:
- Авторизоваться через Notion OAuth
- Выбрать базу данных и страницы для экспорта
- Загрузить свой PPTX шаблон
- Получить готовую презентацию со всем контентом

## Возможности

- OAuth авторизация через Notion
- Выбор из доступных баз данных
- Выбор конкретных страниц для экспорта
- Drag-n-drop загрузка шаблона
- Автоматическое скачивание готового PPTX
- Поддержка текста, картинок и таблиц
- Адаптивный интерфейс

## Быстрый старт

### 1. Установка зависимостей

```bash
cd notion-ppt-web
npm install
```

### 2. Настройка Notion Integration

1. Перейдите на [notion.so/my-integrations](https://notion.so/my-integrations)
2. Создайте новую **Public** интеграцию
3. Укажите OAuth redirect URI: `http://localhost:3000/api/auth/callback/notion`
4. Скопируйте Client ID и Client Secret

### 3. Настройка переменных окружения

Создайте файл `.env.local`:

```bash
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret
AUTH_SECRET=your_random_secret_32_chars_min
NEXTAUTH_URL=http://localhost:3000
```

Для генерации AUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## Деплой на Vercel

### 1. Подготовка

```bash
# Установите Vercel CLI
npm i -g vercel

# Залогиньтесь
vercel login
```

### 2. Деплой

```bash
vercel
```

### 3. Настройка переменных окружения в Vercel

В Vercel Dashboard → Settings → Environment Variables добавьте:

| Variable | Value |
|----------|-------|
| `NOTION_CLIENT_ID` | Ваш Client ID из Notion |
| `NOTION_CLIENT_SECRET` | Ваш Client Secret из Notion |
| `AUTH_SECRET` | Случайная строка 32+ символов |

### 4. Обновите OAuth redirect URI

В настройках Notion интеграции обновите redirect URI на:
```
https://your-app.vercel.app/api/auth/callback/notion
```

## Требования к Notion базе данных

### Обязательные свойства

- **Slide type** (Select): значения `Text`, `Screenshot`, `Text+Screenshot`, `Table`

### Рекомендуемые свойства

- **Bank Name** (Select или Rich Text): название банка/организации
- **Title** (Title): заголовок записи

### Контент страницы

- Текстовые блоки (paragraph, heading, list) → Body shape
- Image блоки → Image 1, Image 2, Image 3 shapes
- Table блоки → таблицы

## Требования к PPTX шаблону

Откройте Selection Pane (⌥+F10 на Mac, Alt+F10 на Windows) и переименуйте shapes:

| Shape Name | Назначение |
|------------|------------|
| `Title` | Заголовок слайда |
| `Body` | Основной текст |
| `BankName1` | Название банка |
| `Image 1` | Первая картинка |
| `Image 2` | Вторая картинка |
| `Image 3` | Третья картинка |

## Технический стек

- **Framework:** Next.js 14 (App Router)
- **UI:** TailwindCSS + shadcn/ui
- **Auth:** NextAuth.js с Notion OAuth
- **PPTX:** JSZip для модификации XML
- **Deploy:** Vercel

## Структура проекта

```
notion-ppt-web/
├── app/
│   ├── page.tsx              # Landing page
│   ├── dashboard/page.tsx    # Dashboard
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── databases/route.ts
│       ├── pages/[databaseId]/route.ts
│       └── export/route.ts
├── components/
│   ├── DashboardClient.tsx
│   └── ui/                   # shadcn компоненты
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── notion.ts             # Notion API wrapper
│   ├── types.ts              # TypeScript типы
│   ├── templateBindings.ts   # Маппинг shapes
│   └── pptx/
│       └── buildPresentation.ts
└── README.md
```

## Ограничения

- **Vercel Hobby:** timeout 10 сек (достаточно для ~10-20 слайдов)
- **Размер PPTX:** до 4.5 MB на Vercel
- **Картинки:** до 3 на слайд

Для больших презентаций рекомендуется Vercel Pro или self-hosted решение.
