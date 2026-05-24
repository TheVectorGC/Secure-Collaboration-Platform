# Vector Backend

Vector Backend — серверная часть защищённого корпоративного desktop-мессенджера Vector. Backend состоит из независимых Spring Boot сервисов, которые взаимодействуют через HTTP API, Kafka events и собственные базы данных.

Документ описывает состав backend, два сценария локального запуска, профили конфигурации и основные эксплуатационные правила.

## Состав backend

| Сервис | Порт | Назначение |
|---|---:|---|
| identity-service | 8085 | Аккаунты, профили, устройства, JWT, refresh sessions, bootstrap admin, блокировки пользователей |
| crypto-service | 8086 | Публичные ключи устройств, prekey bundles, account backup profiles |
| messaging-service | 8087 | Direct/self/group chats, сообщения, E2E envelopes, delivery states, group history visibility, block read-model |
| realtime-gateway | 8088 | WebSocket gateway, realtime delivery, typing, presence |
| media-service | 8089 | Хранение encrypted media bytes и управление доступом к media files |
| document-service | 8090 | Защищённые документы, подписанты, подписи, observers, encrypted document key envelopes |

## Инфраструктура

| Компонент | Порт | Назначение |
|---|---:|---|
| PostgreSQL identity | 5433 | База identity-service |
| PostgreSQL crypto | 5434 | База crypto-service |
| PostgreSQL messaging | 5435 | База messaging-service |
| PostgreSQL media | 5436 | База media-service |
| PostgreSQL document | 5437 | База document-service |
| Redis identity | 6380 | Rate limiting identity-service |
| Redis crypto | 6381 | Rate limiting crypto-service |
| Redis messaging | 6382 | Rate limiting messaging-service |
| Redis realtime | 6383 | Presence state realtime-gateway |
| Redis media | 6384 | Rate limiting media-service |
| Redis document | 6385 | Rate limiting document-service |
| Kafka | 9092 | Event bus |
| Kafka UI | 9090 | Локальная панель Kafka |
| Vault | 8200 | Transit signing key для JWT |

## Требования

Для локальной разработки нужны:

- Java 21;
- Docker Desktop;
- Maven Wrapper из каждого сервиса;
- свободные порты `5433–5437`, `6380–6385`, `8085–8090`, `9090`, `9092`, `8200`.

## Профили конфигурации

Во всех сервисах используются единые профили:

- `dev` — локальная разработка, Swagger включён, actuator открыт шире, используются локальные инфраструктурные значения;
- `prod` — production-like профиль, Swagger выключен, actuator ограничен `health/info`, секреты и адреса берутся из переменных окружения.

## Структура backend

```text
backend/
  docker-compose.yaml
  identity-service/
  crypto-service/
  messaging-service/
  realtime-gateway/
  media-service/
  document-service/
```

## Сценарий 1: запуск всего backend через root compose

Этот сценарий нужен для демонстрации, проверки проекта одной командой и запуска без IDEA.

Root `docker-compose.yaml` поднимает:

- все PostgreSQL базы;
- отдельный Redis для каждого сервиса;
- один общий Kafka;
- один Kafka UI;
- один общий Vault;
- все backend-сервисы контейнерами.

Запуск всего backend:

```bash
docker compose up -d --build
```

Просмотр логов всех сервисов:

```bash
docker compose logs -f
```

Просмотр логов конкретного сервиса:

```bash
docker compose logs -f messaging-service
```

Остановка без удаления данных:

```bash
docker compose down
```

Полный сброс локальных баз, Redis, Kafka и файловых volumes:

```bash
docker compose down -v
```

После изменения Liquibase changelog в текущей стадии разработки обычно нужен именно `docker compose down -v`, потому что обратная совместимость миграций не поддерживается.

## Сценарий 2: запуск сервисов из IDEA

Этот сценарий используется для разработки: инфраструктура запускается через локальные compose-файлы, а Java-сервисы запускаются из IDEA с профилем `dev`.

В этом режиме есть важное правило:

```text
identity-service/docker-compose.yaml запускается первым.
```

Он поднимает общую инфраструктуру всего backend:

- Kafka;
- Kafka UI;
- Kafka init;
- Vault;
- Vault init;
- PostgreSQL identity;
- Redis identity.

Остальные локальные compose-файлы поднимают только зависимости конкретного сервиса:

- `crypto-service`: PostgreSQL crypto + Redis crypto;
- `messaging-service`: PostgreSQL messaging + Redis messaging;
- `media-service`: PostgreSQL media + Redis media;
- `document-service`: PostgreSQL document + Redis document;
- `realtime-gateway`: Redis realtime.

### Порядок запуска для IDEA

Сначала поднять общую инфраструктуру:

```bash
cd identity-service
docker compose up -d
```

Проверить, что init-контейнеры завершились без ошибки:

```bash
docker logs kafka-backend-init
docker logs vault-backend-init
```

После этого остальные локальные compose можно запускать в любом порядке:

```bash
cd ../crypto-service
docker compose up -d

cd ../messaging-service
docker compose up -d

cd ../media-service
docker compose up -d

cd ../document-service
docker compose up -d

cd ../realtime-gateway
docker compose up -d
```

Затем backend-сервисы запускаются из IDEA с профилем `dev`.

Для запуска из IDEA сервисы используют общие адреса:

```text
Kafka: localhost:9092
Vault: http://localhost:8200
```

А Redis и PostgreSQL у каждого сервиса свои локальные порты.

### Остановка локальной инфраструктуры для IDEA

Останавливать можно из папок сервисов:

```bash
docker compose down
```

Для полного сброса данных конкретного сервиса:

```bash
docker compose down -v
```

Если нужно полностью пересоздать весь локальный стенд IDEA-сценария, выполнить `docker compose down -v` в папках всех сервисов, где поднималась инфраструктура.

## Swagger

В `dev` профиле Swagger доступен по адресам:

```text
http://localhost:8085/swagger-ui.html
http://localhost:8086/swagger-ui.html
http://localhost:8087/swagger-ui.html
http://localhost:8088/swagger-ui.html
http://localhost:8089/swagger-ui.html
http://localhost:8090/swagger-ui.html
```

В `prod` профиле Swagger выключен.

## Actuator

В `dev` профиле доступны расширенные actuator endpoints, включая metrics и loggers.

В `prod` профиле доступны только:

```text
/actuator/health
/actuator/info
```

Health details в `prod` скрыты.

## Vault

В локальной разработке используется Vault dev server с root token:

```text
VAULT_TOKEN=root
VAULT_URI=http://localhost:8200
```

Для контейнерного root compose backend-сервисы используют внутренний адрес:

```text
VAULT_URI=http://vault:8200
```

Одноразовый контейнер `vault-init` / `vault-backend-init` включает transit engine и создаёт ключ:

```text
identity-service-jwt-ed25519
```

Этот контейнер нужен только для локальной инфраструктуры. В production Vault должен быть подготовлен отдельно.

## Kafka

Kafka используется для событий:

- `identity.events` — события identity-service, включая block/unblock;
- `messaging.events` — события messaging-service для realtime delivery;
- `document.events` — события document-service для realtime delivery.

Одноразовый init-контейнер создаёт топики:

```text
identity.events
messaging.events
document.events
```

В IDEA-сценарии Kafka поднимается через `identity-service/docker-compose.yaml` и доступна сервисам по адресу:

```text
localhost:9092
```

В root compose backend-сервисы используют внутренний адрес:

```text
kafka:29092
```

Kafka UI доступен локально:

```text
http://localhost:9090
```

## Redis

Redis используется для двух задач:

- `realtime-gateway` хранит presence state, last seen и TTL-based online cleanup;
- REST-сервисы используют Redis для rate limiting API.

Redis не общий: у каждого сервиса свой Redis-инстанс.

| Сервис | Redis port для IDEA/dev |
|---|---:|
| identity-service | 6380 |
| crypto-service | 6381 |
| messaging-service | 6382 |
| realtime-gateway | 6383 |
| media-service | 6384 |
| document-service | 6385 |

Ключевой материал, ciphertext, media bytes и document keys в Redis не кэшируются.

Rate limit работает так:

- для авторизованных запросов лимит считается по `accountId`;
- для публичных запросов лимит считается по IP;
- если Redis временно недоступен, запрос не ломается: сервис пишет warning и пропускает запрос.

## Outbox

Для надёжной доставки Kafka events используется transactional outbox.

Сервис сначала сохраняет доменное изменение и outbox event в одной транзакции БД, а отдельный dispatcher публикует событие в Kafka с retry-механизмом.

Outbox используется там, где потеря события критична:

- identity-service;
- messaging-service;
- document-service.

В `dev` и root compose outbox включён по умолчанию.

## Логи и request id

Все сервисы используют `X-Request-Id`.

Если header пришёл от клиента или другого сервиса, он используется. Если header отсутствует, сервис генерирует новый request id и возвращает его в response header.

Request id добавляется в MDC и попадает в логи, а также передаётся через outbox/Kafka events в `requestId` field и Kafka header. Это позволяет связать HTTP-запрос, доменное событие и realtime delivery в одной диагностической цепочке.

Правила логирования:

- `INFO` — значимые бизнес-события без чувствительных данных;
- `DEBUG` — подробная диагностика только для разработки;
- `WARN` — ожидаемые ошибки и отказы;
- `ERROR` — неожиданные сбои.

В логах нельзя писать пароли, JWT, refresh tokens, private keys, plaintext, ciphertext целиком, signatures целиком и encrypted key material.

## Локальный bootstrap admin

В `dev` профиле bootstrap admin включается через env:

```text
INITIAL_ADMIN_ENABLED=true
```

Стандартные локальные значения:

```text
admin / InitialPassword123!
```

В production-like конфигурации bootstrap admin должен быть выключен по умолчанию и включаться только на первичное развёртывание через переменные окружения.

## Production notes

Root compose предназначен для локальной разработки и демонстрационного стенда.

Для production нужно отдельно настроить:

- managed PostgreSQL или защищённые PostgreSQL контейнеры;
- отдельные Redis-инстансы для сервисов;
- production Vault auth вместо root token;
- production Kafka;
- TLS termination;
- закрытые CORS origins;
- закрытый Swagger;
- ограниченный actuator;
- секреты через env/secret manager;
- backup volumes;
- мониторинг логов и метрик.
