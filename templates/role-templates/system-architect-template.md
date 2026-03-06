# System Architect Analysis Template

This template guides system-architect role analysis to produce SPEC.md-level precision modeling.

## Required Sections

### 1. Architecture Overview
High-level system architecture and component interaction.

### 2. Data Model

Define 3-5 core entities with precise field definitions.

**Template**:
```markdown
## Data Model

### Entity: [EntityName]

**Purpose**: [What this entity represents]

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | NOT NULL, PRIMARY KEY | Unique identifier |
| status | Enum(created, active, suspended, deleted) | NOT NULL, DEFAULT 'created' | Entity lifecycle state |
| created_at | Timestamp | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | Timestamp | NOT NULL, DEFAULT NOW() | Last update timestamp |
| [field_name] | [type] | [constraints] | [description] |

**Relationships**:
- [EntityA] → [EntityB]: [relationship type] (one-to-many, many-to-many, etc.)
- Foreign keys: [field] REFERENCES [table(field)]

**Indexes**:
- PRIMARY KEY: id
- INDEX: status, created_at
- UNIQUE: [unique_field]
```

**Example**:
```markdown
### Entity: Order

**Purpose**: Represents a customer purchase order

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | UUID | NOT NULL, PRIMARY KEY | Unique order identifier |
| user_id | UUID | NOT NULL, FOREIGN KEY | Reference to User entity |
| status | Enum(pending, processing, completed, cancelled) | NOT NULL, DEFAULT 'pending' | Order lifecycle state |
| total_amount | Decimal(10,2) | NOT NULL, CHECK (total_amount >= 0) | Total order amount in USD |
| created_at | Timestamp | NOT NULL, DEFAULT NOW() | Order creation time |
| updated_at | Timestamp | NOT NULL, DEFAULT NOW() | Last status update time |

**Relationships**:
- Order → User: many-to-one (each order belongs to one user)
- Order → OrderItem: one-to-many (each order contains multiple items)

**Indexes**:
- PRIMARY KEY: id
- INDEX: user_id, status, created_at
- COMPOSITE INDEX: (user_id, status) for user order queries
```

### 3. State Machine

Define lifecycle state machines for entities with complex workflows.

**Template**:
```markdown
## State Machine: [EntityName] Lifecycle

**ASCII State Diagram**:
```
[Initial] --event--> [State1] --event--> [State2] --event--> [Final]
    |                   |                   |
    +---error-----------+---error-----------+----> [Error State]
```

**State Definitions**:
| State | Description | Entry Conditions | Exit Events |
|-------|-------------|------------------|-------------|
| [state] | [what this state means] | [conditions to enter] | [events that trigger exit] |

**State Transitions**:
| From State | Event | To State | Side Effects | Validation |
|------------|-------|----------|--------------|------------|
| [from] | [event] | [to] | [what happens] | [pre-conditions] |

**Error Handling**:
| Error Scenario | From State | Recovery Action | Timeout |
|----------------|------------|-----------------|---------|
| [error] | [state] | [action] | [duration] |
```

**Example**:
```markdown
## State Machine: Order Lifecycle

**ASCII State Diagram**:
```
[Created] --submit--> [Pending] --process--> [Processing] --complete--> [Completed]
    |                     |                       |
    |                     +---cancel--------------> [Cancelled]
    |                     |                       |
    +---timeout-----------+---payment_failed------> [Failed]
```

**State Definitions**:
| State | Description | Entry Conditions | Exit Events |
|-------|-------------|------------------|-------------|
| Created | Order initialized but not submitted | User adds items to cart | submit, timeout |
| Pending | Order submitted, awaiting payment | Payment initiated | process, cancel, payment_failed |
| Processing | Payment confirmed, fulfilling order | Payment successful | complete, cancel |
| Completed | Order fulfilled and delivered | All items shipped | - |
| Cancelled | Order cancelled by user or system | User cancels or admin cancels | - |
| Failed | Order failed due to payment or system error | Payment failed or timeout | - |

**State Transitions**:
| From State | Event | To State | Side Effects | Validation |
|------------|-------|----------|--------------|------------|
| Created | submit | Pending | Initiate payment, lock inventory | Cart not empty, items available |
| Pending | process | Processing | Charge payment, allocate inventory | Payment authorized |
| Pending | cancel | Cancelled | Release inventory, refund if paid | User request or timeout |
| Pending | payment_failed | Failed | Release inventory, notify user | Payment gateway error |
| Processing | complete | Completed | Ship items, send confirmation | All items shipped |
| Processing | cancel | Cancelled | Stop fulfillment, refund payment | Admin approval required |

**Error Handling**:
| Error Scenario | From State | Recovery Action | Timeout |
|----------------|------------|-----------------|---------|
| Payment timeout | Pending | Auto-cancel, release inventory | 15 minutes |
| Inventory unavailable | Processing | Cancel order, full refund | Immediate |
| Shipping failure | Processing | Retry 3x, then cancel | 24 hours |
```

### 4. Error Handling Strategy

Define global error handling approach.

**Template**:
```markdown
## Error Handling Strategy

### Error Classification
| Error Type | Classification | Retry Strategy | User Impact |
|------------|----------------|----------------|-------------|
| [error] | Transient/Permanent/Degraded | [strategy] | [impact] |

### Recovery Mechanisms
| Component | Error | Recovery | Timeout | Fallback |
|-----------|-------|----------|---------|----------|
| [component] | [error] | [action] | [duration] | [fallback] |

### Circuit Breaker
- **Threshold**: [failure count] failures in [time window]
- **Open Duration**: [duration]
- **Half-Open Test**: [test strategy]
```

**Example**:
```markdown
## Error Handling Strategy

### Error Classification
| Error Type | Classification | Retry Strategy | User Impact |
|------------|----------------|----------------|-------------|
| DB Connection Lost | Transient | Exponential backoff, 3 retries | Request delayed 1-5s |
| Invalid Input | Permanent | No retry, return 400 | Immediate error response |
| Payment Gateway Timeout | Transient | Retry 2x with 5s delay | Order pending, notify user |
| Inventory Service Down | Degraded | Use cached data, mark stale | Show approximate availability |

### Recovery Mechanisms
| Component | Error | Recovery | Timeout | Fallback |
|-----------|-------|----------|---------|----------|
| Database | Connection lost | Retry 3x with exponential backoff (1s, 2s, 4s) | 10s total | Return 503 Service Unavailable |
| Payment Gateway | Timeout | Retry 2x with 5s delay | 15s total | Mark order as pending, async retry |
| Inventory Service | Service down | Use cached inventory (max 5min old) | 3s | Show "limited availability" |
| Email Service | Send failure | Queue for async retry (5 attempts over 24h) | N/A | Log failure, continue order |

### Circuit Breaker
- **Threshold**: 5 failures in 60 seconds
- **Open Duration**: 30 seconds
- **Half-Open Test**: Single request, if success → close, if fail → open for 60s
```

### 5. Observability Requirements

Define metrics, logs, and health checks.

**Template**:
```markdown
## Observability Requirements

### Metrics
| Metric Name | Type | Labels | Description | Alert Threshold |
|-------------|------|--------|-------------|-----------------|
| [metric] | Counter/Gauge/Histogram | [labels] | [description] | [threshold] |

### Log Events
| Event | Level | Fields | When to Log |
|-------|-------|--------|-------------|
| [event] | INFO/WARN/ERROR | [fields] | [condition] |

### Health Checks
| Endpoint | Check | Success Criteria | Timeout |
|----------|-------|------------------|---------|
| [endpoint] | [check] | [criteria] | [duration] |
```

**Example**:
```markdown
## Observability Requirements

### Metrics
| Metric Name | Type | Labels | Description | Alert Threshold |
|-------------|------|--------|-------------|-----------------|
| http_request_duration_ms | Histogram | endpoint, method, status | Request latency distribution | P99 > 500ms |
| active_orders | Gauge | status | Current orders by status | - |
| order_state_transitions | Counter | from_state, to_state, event | State transition count | - |
| payment_failures | Counter | reason | Payment failure count | > 10/min |
| db_connection_pool_size | Gauge | pool_name | Active DB connections | > 80% capacity |

### Log Events
| Event | Level | Fields | When to Log |
|-------|-------|--------|-------------|
| order_created | INFO | order_id, user_id, total_amount | Every order creation |
| order_state_changed | INFO | order_id, from_state, to_state, event | Every state transition |
| payment_failed | WARN | order_id, user_id, reason, amount | Payment failure |
| inventory_unavailable | ERROR | order_id, item_id, requested_qty | Inventory check fails |
| circuit_breaker_opened | ERROR | component, failure_count | Circuit breaker opens |

### Health Checks
| Endpoint | Check | Success Criteria | Timeout |
|----------|-------|------------------|---------|
| /health/live | Process alive | HTTP 200 | 1s |
| /health/ready | DB + Cache reachable | HTTP 200, all deps OK | 5s |
| /health/db | Database query | SELECT 1 succeeds | 3s |
| /health/cache | Cache ping | PING succeeds | 2s |
```

### 6. Configuration Model

Define all configurable parameters for the system.

**Template**:
```markdown
## Configuration Model

| Config Key | Type | Default | Constraint | Description | Environment |
|------------|------|---------|------------|-------------|-------------|
| [key] | [type] | [default] | [constraint] | [description] | [env] |

**Configuration Categories**:
- **Application**: Core application settings
- **Database**: Database connection and pool settings
- **Cache**: Cache configuration
- **Security**: Authentication and authorization settings
- **Observability**: Logging and monitoring settings

**Validation Rules**:
- [Config key] MUST be [constraint]
- [Config key] SHOULD be [recommendation]

**Configuration Loading**:
- Priority: Environment variables > Config file > Defaults
- Hot reload: [Supported/Not supported]
```

**Example**:
```markdown
## Configuration Model

| Config Key | Type | Default | Constraint | Description | Environment |
|------------|------|---------|------------|-------------|-------------|
| SERVER_PORT | int | 8080 | 1024-65535 | HTTP server port | APP_PORT |
| DB_HOST | string | localhost | Valid hostname/IP | Database host | DATABASE_HOST |
| DB_PORT | int | 5432 | 1024-65535 | Database port | DATABASE_PORT |
| DB_MAX_CONNECTIONS | int | 100 | 10-1000 | Max DB connection pool size | DB_POOL_SIZE |
| CACHE_TTL_SECONDS | int | 3600 | 60-86400 | Cache entry TTL | CACHE_TTL |
| SESSION_TIMEOUT_SECONDS | int | 1800 | 300-7200 | User session timeout | SESSION_TIMEOUT |
| LOG_LEVEL | enum | INFO | DEBUG/INFO/WARN/ERROR | Logging level | LOG_LEVEL |
| ENABLE_METRICS | bool | true | true/false | Enable Prometheus metrics | METRICS_ENABLED |
| RATE_LIMIT_PER_MINUTE | int | 100 | 1-10000 | API rate limit per user | RATE_LIMIT |

**Configuration Categories**:
- **Application**: SERVER_PORT, LOG_LEVEL
- **Database**: DB_HOST, DB_PORT, DB_MAX_CONNECTIONS
- **Cache**: CACHE_TTL_SECONDS
- **Security**: SESSION_TIMEOUT_SECONDS
- **Observability**: ENABLE_METRICS, LOG_LEVEL

**Validation Rules**:
- DB_MAX_CONNECTIONS MUST be <= database server max_connections
- SESSION_TIMEOUT_SECONDS SHOULD be >= 300 (5 minutes) for security
- CACHE_TTL_SECONDS MUST be > 0
- RATE_LIMIT_PER_MINUTE SHOULD be tuned based on expected load

**Configuration Loading**:
- Priority: Environment variables > config.yaml > Defaults
- Hot reload: Supported for LOG_LEVEL, CACHE_TTL_SECONDS, RATE_LIMIT_PER_MINUTE
- Restart required: SERVER_PORT, DB_HOST, DB_PORT
```

### 7. Boundary Scenarios

Define system behavior in edge cases and operational scenarios.

**Template**:
```markdown
## Boundary Scenarios

### Concurrency
- **Max Concurrent Requests**: [number]
- **Queueing Strategy**: [Drop oldest / Block / Return 503]
- **Thread Pool Size**: [number]
- **Connection Pool Size**: [number]

### Rate Limiting
- **Per-User Limit**: [requests/minute]
- **Global Limit**: [requests/minute]
- **Burst Allowance**: [number]
- **Rate Limit Response**: HTTP 429 with Retry-After header

### Graceful Shutdown
- **Drain Period**: [duration] - Stop accepting new requests
- **In-Flight Timeout**: [duration] - Wait for active requests
- **Force Kill After**: [duration] - Hard shutdown
- **Shutdown Hooks**: [cleanup actions]

### Resource Cleanup
- **Idle Connection Timeout**: [duration]
- **Stale Session Cleanup**: [frequency]
- **Temporary File Cleanup**: [frequency]
- **Log Rotation**: [frequency/size]

### Scalability
- **Horizontal Scaling**: [Supported/Not supported]
- **Stateless Design**: [Yes/No]
- **Shared State**: [Redis/Database/None]
- **Load Balancing**: [Round-robin/Least-connections/IP-hash]

### Disaster Recovery
- **Backup Frequency**: [frequency]
- **Backup Retention**: [duration]
- **Recovery Time Objective (RTO)**: [duration]
- **Recovery Point Objective (RPO)**: [duration]
```

**Example**:
```markdown
## Boundary Scenarios

### Concurrency
- **Max Concurrent Requests**: 1000 per instance
- **Queueing Strategy**: Return HTTP 503 when queue full (max 100 queued)
- **Thread Pool Size**: 200 worker threads
- **Connection Pool Size**: 100 database connections

### Rate Limiting
- **Per-User Limit**: 100 requests/minute
- **Global Limit**: 10,000 requests/minute per instance
- **Burst Allowance**: 20 requests (allow short bursts)
- **Rate Limit Response**: HTTP 429 with `Retry-After: 60` header

### Graceful Shutdown
- **Drain Period**: 10 seconds - Stop accepting new requests, return 503
- **In-Flight Timeout**: 30 seconds - Wait for active requests to complete
- **Force Kill After**: 60 seconds - Hard shutdown if requests still active
- **Shutdown Hooks**:
  - Close database connections
  - Flush metrics to monitoring system
  - Save in-memory cache to Redis
  - Deregister from service discovery

### Resource Cleanup
- **Idle Connection Timeout**: 5 minutes - Close idle DB connections
- **Stale Session Cleanup**: Every 1 hour - Remove expired sessions
- **Temporary File Cleanup**: Every 24 hours - Delete files older than 7 days
- **Log Rotation**: Daily or when file size > 100MB

### Scalability
- **Horizontal Scaling**: Supported - Stateless design
- **Stateless Design**: Yes - All state in Redis/Database
- **Shared State**: Redis for sessions, PostgreSQL for persistent data
- **Load Balancing**: Least-connections algorithm (sticky sessions not required)

### Disaster Recovery
- **Backup Frequency**: Database backup every 6 hours
- **Backup Retention**: 30 days
- **Recovery Time Objective (RTO)**: 1 hour - System operational within 1 hour
- **Recovery Point Objective (RPO)**: 6 hours - Max 6 hours of data loss acceptable
```

## Usage Instructions

When generating system-architect analysis:
1. Architecture Overview (high-level)
2. Data Model (3-5 core entities)
3. State Machine (1-2 entities with complex lifecycle)
4. Error Handling Strategy (global + per-component)
5. Observability Requirements (metrics, logs, health checks)
6. Configuration Model (all configurable parameters)
7. Boundary Scenarios (concurrency, rate limiting, shutdown, cleanup, scalability, DR)

All sections MUST use RFC 2119 keywords (MUST, SHOULD, MAY) for constraints.
