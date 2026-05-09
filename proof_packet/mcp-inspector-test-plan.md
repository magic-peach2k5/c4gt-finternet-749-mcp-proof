# MCP Inspector test plan

Status: planned validation. Run after private repo/dev-instance access.

## Shared assertions

- Validation rejects malformed tool input before UNITS API calls.
- Delegation guard runs before scoped account, token, credential, or event data is returned.
- No response exposes private keys or raw credential claim values.
- Scope failures return structured `SCOPE_EXCEEDED`.
- `initiate_transfer` refuses missing, failed, or stale preflight.
- Tool calls record acting account, delegation id, request id, tool name, and result code.

## Workflow 1: scope and account summary

Sequence:

```text
get_delegation_scope -> get_account_summary
```

Expected:

- active delegation returned,
- token/account summary limited to delegated scope,
- credential summary contains metadata only.

Evidence:

- MCP Inspector request/response capture,
- redaction scan,
- audit log line.

## Workflow 2: valid transfer preflight

Sequence:

```text
check_transfer_eligibility
```

Expected:

- `eligible: true`,
- `preflightId` returned,
- scope, dependency, and credential checks included,
- no side effects.

## Workflow 3: scope exceeded

Sequence:

```text
check_transfer_eligibility
```

Input: amount above delegation remaining limit.

Expected:

- `eligible: false`,
- error code `SCOPE_EXCEEDED`,
- detail includes requested and remaining amount,
- `safeToRetry: false` unless adjusted amount is possible.

## Workflow 4: credential-gated transfer

Sequence:

```text
check_transfer_eligibility -> present_credential_vp
```

Expected:

- first response identifies credential requirement,
- VP tool submits/constructs presentation through server-side credential path,
- raw credential values are not exposed.

## Workflow 5: transfer commit

Sequence:

```text
check_transfer_eligibility -> initiate_transfer
```

Expected:

- commit path requires valid preflight,
- transaction status returned,
- audit record includes acting account and delegation id.

## Workflow 6: lifecycle event

Sequence:

```text
subscribe_lifecycle_events
```

Expected:

- subscription is scoped by account, token class, and event type,
- no broad transaction feed is exposed,
- transfer/credential/dependency events use stable payload shape.
