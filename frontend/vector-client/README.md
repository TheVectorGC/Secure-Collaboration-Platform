# Vector Client

Frontend-часть проекта Vector: desktop-клиент защищённого корпоративного мессенджера на React, TypeScript, Vite и Electron.

Приложение предназначено для запуска как Windows desktop-программа. В режиме разработки React запускается через Vite dev-server, а Electron открывает этот dev-server. В production-сборке Electron открывает уже собранный `dist/index.html`.

## Технологии

- React 18
- TypeScript
- Vite
- Electron
- electron-builder
- Inno Setup
- Tailwind CSS
- Zustand
- Axios
- `better-sqlite3-multiple-ciphers`
- `@signalapp/libsignal-client`

## Что должно быть запущено на backend

Для полноценной проверки клиента нужны backend-сервисы проекта Vector. Минимально для обычной работы клиента должны быть доступны сервисы, которые используются frontend-ом через API и WebSocket:

- identity-service
- crypto-service
- messaging-service
- realtime-gateway
- media-service
- document-service

Если backend не запущен, frontend может открыться, но вход, чаты, online/offline, сообщения, файлы и документы работать нормально не будут.

## Установка зависимостей

Из папки `frontend/vector-client`:

```powershell
npm install
```

`node_modules` в репозиторий не добавляется. После очистки проекта достаточно снова выполнить `npm install`.

## Основные npm-скрипты

```powershell
npm run dev
```

Запускает Vite dev-server для React-приложения.

```powershell
npm run electron
```

Запускает Electron-клиент и подключает его к Vite dev-server на `http://localhost:5173`.

```powershell
npm run dev:electron
```

Запускает Vite и Electron одной командой.

```powershell
npm run electron:admin
npm run electron:ivan
npm run electron:petr
```

Запускает Electron с разными локальными профилями. Это используется для проверки нескольких устройств на одном Windows-компьютере.

```powershell
npm run build
```

Собирает frontend: сначала TypeScript, затем Vite production build.

```powershell
npm run rebuild:electron
```

Пересобирает native-зависимости под текущую версию Electron.

```powershell
npm run package:win
```

Собирает Windows-приложение через electron-builder в папку `release/win-unpacked`.

```powershell
npm run installer:win
```

Собирает Windows-приложение через electron-builder, затем создаёт установщик через Inno Setup.

```powershell
npm run installer:clean
```

Удаляет локальные папки сборки:

- `dist`
- `release`
- `out`

Эта команда не удаляет пользовательские данные из `%APPDATA%` и `%LOCALAPPDATA%`.

## Запуск в режиме разработки через VS Code

Открой папку `frontend/vector-client` в VS Code.

В первом терминале запусти Vite:

```powershell
npm run dev
```

Во втором терминале запусти Electron:

```powershell
npm run electron
```

Можно использовать один общий скрипт:

```powershell
npm run dev:electron
```

Если Electron открыл экран с сообщением, что Vite dev-server не запущен, значит `npm run electron` был запущен раньше, чем поднялся Vite, или порт `5173` недоступен.

## Запуск отдельных профилей в режиме разработки

Для тестирования multi-device на одном компьютере используются разные Electron-профили. Каждый профиль имеет отдельную папку `userData`, отдельное локальное crypto-хранилище, отдельные ключи и отдельную сессию.

Запуск профиля администратора:

```powershell
npm run electron:admin
```

Запуск профиля Ивана:

```powershell
npm run electron:ivan
```

Запуск профиля Петра:

```powershell
npm run electron:petr
```

Эти команды используют переменную окружения `VECTOR_PROFILE`:

- `admin-device`
- `ivan-device`
- `petr-device`

На Windows данные профилей будут храниться примерно здесь:

```text
%APPDATA%\vector-client-admin-device
%APPDATA%\vector-client-ivan-device
%APPDATA%\vector-client-petr-device
```

Внутри каждого профиля есть своё локальное состояние приложения, включая crypto-данные.

Важно: имя профиля не равно имени аккаунта. Например, можно войти аккаунтом `ivan` сразу в три профиля. Тогда это будет один аккаунт на трёх разных устройствах.

## Обычный запуск без профиля

Команда:

```powershell
npm run electron
```

запускает приложение без `VECTOR_PROFILE`. В этом случае используется обычный Electron userData-профиль приложения.

В установленной версии обычный запуск через ярлык или `Vector.exe` тоже идёт без `VECTOR_PROFILE`.

Обычная папка данных на Windows:

```text
%APPDATA%\Vector
```

## Локальные пользовательские данные

Клиент использует Electron `app.getPath('userData')`. Внутри userData хранится локальное состояние, включая crypto-данные.

Примерные пути:

```text
%APPDATA%\Vector
%APPDATA%\vector-client-admin-device
%APPDATA%\vector-client-ivan-device
%APPDATA%\vector-client-petr-device
```

Папка `crypto` внутри профиля содержит локальные защищённые данные клиента. Не удаляй её без необходимости, если нужно сохранить устройство, ключи и сессию.

Logout внутри приложения не должен удалять локальное устройство и ключи. Повторный login того же аккаунта в тот же профиль должен использовать существующее локальное устройство.

## Проверка multi-device

Для проверки одного аккаунта на нескольких устройствах:

1. Запусти Vite:

```powershell
npm run dev
```

2. В разных терминалах запусти несколько профилей:

```powershell
npm run electron:admin
npm run electron:ivan
npm run electron:petr
```

3. Войди одним и тем же аккаунтом в несколько профилей.

Каждый профиль будет отдельным устройством одного аккаунта.

Для проверки нескольких аккаунтов:

1. Запусти несколько профилей.
2. Войди в них разными аккаунтами, например `admin`, `ivan`, `petr`.

## Сборка production frontend

```powershell
npm run build
```

После успешной сборки появится папка:

```text
dist
```

В ней лежит production-версия React-приложения.

## Сборка Windows-приложения без установщика

```powershell
npm run installer:clean
npm run package:win
```

Результат:

```text
release\win-unpacked\Vector.exe
```

Проверять electron-builder-сборку можно напрямую запуском:

```powershell
.\release\win-unpacked\Vector.exe
```

Это нормальный способ быстро проверить production Electron build без установки через Inno Setup.

## Сборка Windows-установщика

Для сборки установщика нужен установленный Inno Setup.

Команда:

```powershell
npm run installer:win
```

Она делает два этапа:

1. Собирает приложение через electron-builder в `release/win-unpacked`.
2. Собирает установщик через Inno Setup.

Результат находится в папке:

```text
release
```

Имя установщика имеет вид:

```text
VectorSetup-<version>.exe
```

Например:

```text
VectorSetup-0.8.89.exe
```

## Роль electron-builder и Inno Setup

В проекте используются оба инструмента, но они отвечают за разные задачи.

`electron-builder` собирает само Electron-приложение:

```text
release\win-unpacked\Vector.exe
```

`Inno Setup` создаёт установщик:

```text
release\VectorSetup-<version>.exe
```

В `electron-builder` используется target `dir`, поэтому он не создаёт свой NSIS-установщик. Это сделано специально, чтобы не было двух разных установщиков одновременно.

## Запуск установленной версии с разными профилями

После установки через `VectorSetup` обычный запуск через ярлык использует основной профиль:

```text
%APPDATA%\Vector
```

Для тестирования нескольких устройств можно запускать установленный `Vector.exe` с разными значениями `VECTOR_PROFILE`.

Пример для PowerShell:

```powershell
$env:VECTOR_PROFILE="admin-device"
& "$env:LOCALAPPDATA\Programs\Vector\Vector.exe"
```

```powershell
$env:VECTOR_PROFILE="ivan-device"
& "$env:LOCALAPPDATA\Programs\Vector\Vector.exe"
```

```powershell
$env:VECTOR_PROFILE="petr-device"
& "$env:LOCALAPPDATA\Programs\Vector\Vector.exe"
```

Если приложение установлено в `Program Files`, путь может быть таким:

```powershell
$env:VECTOR_PROFILE="admin-device"
& "C:\Program Files\Vector\Vector.exe"
```

Для передачи проекта на тесты удобно использовать отдельные `.cmd` или `.ps1` запускатели, которые выставляют `VECTOR_PROFILE` и запускают установленный `Vector.exe`.

## Очистка пользовательских данных

`npm run installer:clean` очищает только папки сборки. Он не очищает Electron-профили.

Для очистки локальных Electron/Vector-профилей используется отдельный PowerShell-скрипт:

```powershell
powershell -ExecutionPolicy Bypass -File clean-electron-vector.ps1
```

Скрипт нужен для разработки и тестов. Он удаляет локальные данные профилей. После такой очистки приложение будет считать соответствующий профиль новым устройством.
