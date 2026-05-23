# Сборка desktop-приложения Vector

## Чистая переустановка зависимостей

Если раньше был выполнен `npm install` с другими версиями зависимостей, сначала очисти локальные артефакты:

```powershell
npm run deps:clean
npm install
```

Или одной командой:

```powershell
npm run deps:reinstall
```

Скрипт удаляет только локальные сборочные артефакты проекта: `node_modules`, `package-lock.json`, `dist`, `release`. Пользовательские данные Electron и crypto-хранилище не трогаются.

После первого `npm install` будет создан новый `package-lock.json`. Дальше для повторяемой установки можно использовать:

```powershell
npm ci
```

## Быстрый тест production-режима без инсталлятора

```powershell
npm run electron:prod
```

Этот режим собирает React-приложение в `dist` и запускает Electron уже не через Vite dev-server, а как production-приложение.

## Создать папку с готовым приложением без инсталлятора

```powershell
npm run pack:win
```

Результат появится в `release/win-unpacked`. Это удобно для быстрой проверки перед созданием установщика.

## Создать Windows-инсталлятор

```powershell
npm run installer:win
```

Или через PowerShell-скрипт:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1
```

Готовый установщик будет лежать в папке `release`, например:

```text
release/Vector-Setup-0.1.0-x64.exe
```

## Что изменилось относительно dev-режима

- приложение открывается как `Vector`, а не как dev-окно Electron;
- убрано меню `File / Edit / View / Window / Help`;
- добавлена иконка приложения и установщика;
- окно стартует развёрнутым;
- создаются ярлык на рабочем столе и пункт в меню Пуск;
- данные пользователя и локальное crypto-хранилище не удаляются при обычном uninstall.

## Важно для backend

Инсталлятор собирает только desktop-клиент. Backend-сервисы должны быть запущены отдельно, как и при обычном тестировании проекта.
