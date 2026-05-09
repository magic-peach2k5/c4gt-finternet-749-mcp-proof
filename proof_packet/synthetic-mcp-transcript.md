# Synthetic MCP Transcript - Finternet #749

## Issue
[DMP 2026]: Finternet MCP Server for UNITS API | https://github.com/Code4GovTech/C4GT/issues/749

## Purpose
Demonstrate MCP tool behavior for reviewer understanding. Labeled as synthetic proposal proof, not real MCP Inspector output.

---

## Tool Call 1: list_tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "tools": [
      {
        "name": "check_transfer_eligibility",
        "description": "Verify if a transfer can be initiated for a given account and amount"
      },
      {
        "name": "get_delegation_scope",
        "description": "Return the allowed operations for a delegated account"
      },
      {
        "name": "initiate_transfer",
        "description": "Execute a transfer from delegated account"
      },
      {
        "name": "present_credential_vp",
        "description": "Present a Verifiable Credential as proof"
      }
    ]
  }
}
```

**Safety Check:** Tools are enumerated; no credentials exposed.

---

## Tool Call 2: check_transfer_eligibility

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "method": "tools/call",
  "params": {
    "name": "check_transfer_eligibility",
    "arguments": {
      "account_id": "ACC-2024-001",
      "amount": 50000,
      "currency": "INR"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "result": {
    "eligible": true,
    "limit_remaining": 150000,
    "daily_limit": 200000,
    "requires_preflight": false
  }
}
```

**Safety Check:** Amount within delegated limit; no unauthorized transfer.

---

## Tool Call 3: get_delegation_scope

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "method": "tools/call",
  "params": {
    "name": "get_delegation_scope",
    "arguments": {
      " delegator_id": "DEL-001",
      "delegate_id": "ACC-2024-001"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "scope": [
      "view_balance",
      "initiate_transfer",
      "view_transactions"
    ],
    "expiry": "2026-06-30T00:00:00Z",
    "restrictions": [
      "max_single_transfer: 100000 INR",
      "daily_aggregate: 200000 INR"
    ]
  }
}
```

**Safety Check:** Scope is read from delegation contract; restrictions enforced.

---

## Failed Preflight Example

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "method": "tools/call",
  "params": {
    "name": "initiate_transfer",
    "arguments": {
      "account_id": "ACC-2024-001",
      "amount": 250000,
      "recipient": "ACC-999-999"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "error": {
    "code": -32000,
    "message": "Transfer refused: exceeds daily_aggregate limit",
    "data": {
      "requested": 250000,
      "daily_limit": 200000,
      "remaining_today": 150000
    }
  }
}
```

**Safety Check:** Preflight enforces daily aggregate limit; transfer blocked.

---

## Proof Boundary

This is **synthetic proposal proof** - shows expected MCP tool behavior, not actual MCP Inspector output.

**What's NOT Verified:**
- No private MCP repository access
- No real MCP Inspector run
- No dev UNITS integration
- No live credentials
