# Vector Backend

Vector Backend — серверная часть защищённого корпоративного desktop-мессенджера Vector. Backend построен как набор независимых Spring Boot сервисов, которые взаимодействуют через HTTP API, Kafka events и собственные базы данных.

Документ описывает локальный запуск всего backend-стека, назначение сервисов, профили конфигурации и основные эксплуатационные правила.

## Состав backend

| Сервис | Порт | Назначение |
|---|---:|---|
| identity-service | 8085 | Аккаунты, профили, устройства, JWT, refresh sessions, bootstrap admin, блокировки пользователей |
| crypto-service | 8086 | Публичные ключи устройств, prekey bundles, account backup profiles |
| messaging-service | 8087 | Direct/self/group chats, сообщения, E2E envelopes, delivery states, group history visibility, block read-model |
| realtime-gateway | 8088 | WebSocket gateway, realtime delivery, typing, presence |
| media-service | 8089 | Хранение encrypted media bytes и управление доступом к media files |
| document-service | 8090 | Защищённые документы, подписанты, подписи, observers, encrypted document key envelopes |

Инфраструктура локального стенда:

| Компонент | Порт | Назначение |
|---|---:|---|
| PostgreSQL identity | 5433 | База identity-service |
| PostgreSQL crypto | 5434 | База crypto-service |
| PostgreSQL messaging | 5435 | База messaging-service |
| PostgreSQL media | 5436 | База media-service |
| PostgreSQL document | 5437 | База document-service |
| Kafka | 9092 | Event bus |
| Kafka UI | 9090 | Локальная панель Kafka |
| Redis | 6379 | Presence storage для realtime-gateway |
| Vault | 8200 | Transit signing key для JWT |

## Требования

Для локальной разработки нужны:

- Java 21;
- Docker Desktop;
- Maven Wrapper из каждого сервиса;
- свободные порты `5433–5437`, `6379`, `8085–8090`, `9090`, `9092`, `8200`.

## Профили конфигурации

Во всех сервисах используются единые профили:

- `dev` — локальная разработка, Swagger включён, actuator открыт шире, PostgreSQL доступен с `postgres/postgres`;
- `prod` — production-like профиль, Swagger выключен, actuator ограничен `health/info`, секреты и адреса берутся из переменных окружения.

Локальный root compose запускает сервисы с профилем `dev`.

## Быстрый запуск всего backend

Структура папки должна быть такой:

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

Полный сброс локальных баз и инфраструктурных volumes:

```bash
docker compose down -v
```

После изменения Liquibase changelog в текущей стадии разработки обычно нужно выполнять именно `docker compose down -v`, потому что обратная совместимость миграций не поддерживается.

## Запуск сервиса из IDEA

Для разработки отдельного сервиса можно поднимать его зависимости локальным `docker-compose.yaml` внутри папки сервиса, а сам сервис запускать из IDEA.

Пример для `messaging-service`:

```bash
cd messaging-service
docker compose up -d
./mvnw spring-boot:run
```

При запуске из IDEA профиль по умолчанию — `dev`.

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

В локальном compose используется Vault dev server с root token:

```text
VAULT_TOKEN=root
VAULT_URI=http://vault:8200
```

Одноразовый контейнер `vault-init` включает transit engine и создаёт ключ:

```text
identity-service-jwt-ed25519
```

Этот контейнер нужен только для локальной инфраструктуры. В production Vault должен быть подготовлен отдельно.

## Kafka

Kafka используется для событий:

- `identity.events` — события identity-service, включая block/unblock;
- `messaging.events` — события messaging-service для realtime delivery;
- `document.events` — события document-service для realtime delivery.

Одноразовый контейнер `kafka-init` создаёт топики `identity.events`, `messaging.events` и `document.events` при запуске общего compose.

Kafka UI доступен локально:

```text
http://localhost:9090
```

## Redis

Redis используется для двух инфраструктурных задач:

- `realtime-gateway` хранит presence state, last seen и TTL-based online cleanup;
- backend services используют Redis для rate limiting публичных API; в `dev` лимиты мягкие, чтобы не мешать локальному тестированию, в `prod` rate limiting включён по умолчанию.

Ключевой материал, ciphertext, media bytes и document keys в Redis не кэшируются.

## Outbox

Для надёжной доставки Kafka events используется transactional outbox.

Сервис сначала сохраняет доменное изменение и outbox event в одной транзакции БД, а отдельный dispatcher публикует событие в Kafka с retry-механизмом.

Outbox используется там, где потеря события критична:

- identity-service;
- messaging-service;
- document-service.

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

## Сброс данных

Для полного сброса локальной среды:

```bash
docker compose down -v
```

Это удалит:

- базы всех сервисов;
- Kafka data;
- Redis data;
- локальные media files volume.

## Production notes

Root compose предназначен для локальной разработки и демонстрационного стенда.

Для production нужно отдельно настроить:

- managed PostgreSQL или защищённые PostgreSQL контейнеры;
- production Vault auth вместо root token;
- TLS termination;
- закрытые CORS origins;
- закрытый Swagger;
- ограниченный actuator;
- секреты через env/secret manager;
- backup volumes;
- мониторинг логов и метрик.
