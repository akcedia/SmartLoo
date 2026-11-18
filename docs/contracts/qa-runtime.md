# Local QA runtime configuration

18 November 2026. Refs #60, #56, #59, #61 and #72.

The shared Python dependency file includes PyMongo 4.10.1, redis-py 8.1.0 and tzdata 2026.6. These match the MongoDB and Redis component evidence and provide IANA time-zone data on Windows for Europe/Istanbul calendar boundaries.

| Setting | Local value and owner |
| --- | --- |
| SMARTLOO_MONGO_URL | mongodb://127.0.0.1:27017 for a host process. Match SMARTLOO_MONGO_PORT when publishing on another port. Fırat owns the repository client and database selection. |
| SMARTLOO_REDIS_PORT | Compose host publication, default 6379. Changing it requires matching the application connection URL. |
| Planned application Redis URL | The QA connection contract is SMARTLOO_REDIS_URL, default redis://127.0.0.1:6379/0 for a host process, or redis://redis:6379/0 for a future Compose app container. Özgür and Emir wire this at the application composition root. The current app does not consume this variable yet. |
| Redis client | redis.asyncio, decode_responses=True, connect timeout 1 second, socket timeout 1 second and no automatic retries. Bound the complete summary pipeline by its existing 10-second budget. Close the async client during application shutdown. |
| Redis namespace | Database 0 for local application data. Preserve the service's smartloo:summary: prefix and revision/policy components. Its cache TTL is six hours. |
| SMARTLOO_AI_TEST_REDIS_URL | Explicit isolated component test URL, redis://127.0.0.1:6379/15. The component runner requires this setting. Production URLs and credentials stay outside committed evidence. |

The real Redis suite in #68 covers cache operations using a synthetic provider and in-memory review coordinator. The shared HTTP routes, durable PostgreSQL/MongoDB writer coordination and live OpenAI validation are still integration work. The guarded publication and repair state must be preserved when wiring the clients.
