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

Откройте папку `frontend/vector-client` в VS Code.

В первом терминале запустите Vite:

```powershell
npm run dev
```

Во втором терминале запустите Electron:

```powershell
npm run electron
```

Можно использовать один общий скрипт:

```powershell
npm run dev:electron
```

Если Electron открыл экран с сообщением, что Vite dev-server не запущен, значит `npm run electron` был запущен раньше, чем поднялся Vite, или порт `5173` недоступен.

## Сборка production frontend

```powershell
npm run build
```

После успешной сборки появится папка:

```text
dist
```

В ней лежит production-версия React-приложения.

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

## Очистка пользовательских данных

`npm run installer:clean` очищает только папки сборки. Он не очищает Electron-профили.

Для очистки локальных Electron/Vector-профилей используется отдельный PowerShell-скрипт:

```powershell
powershell -ExecutionPolicy Bypass -File clean-electron-vector.ps1
```

Скрипт нужен для разработки и тестов. Он удаляет локальные данные профилей. После такой очистки приложение будет считать соответствующий профиль новым устройством.
