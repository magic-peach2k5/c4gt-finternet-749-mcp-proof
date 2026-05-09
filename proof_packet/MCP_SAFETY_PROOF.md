# MCP Safety Proof - Finternet #749

## Terminal Proof Screenshot (ASCII capture)

```
$ cd proof_packet && node run-mcp-harness.mjs

=== MCP Tool Safety Harness ===

[1] get_account_summary
✓ Pass - eligible
  { accountId: "ACC_789", balance: 25000, scope: { maxAmount: 50000 } }

[2] check_transfer_eligibility  
  Requested: 75000, Max: 50000
✗ SCOPE_EXCEEDED - blocked correctly
  { 
    error: { code: "SCOPE_EXCEEDED", message: "Requested transfer exceeds delegated amount." },
    audit: { tool: "check_transfer_eligibility", sideEffectFree: true }
  }

[3] get_delegation_scope
✓ Pass - eligible
  { scopeMax: 50000, expiry: "2026-06-30" }

=== Safety Invariant Proof ===

✓ get_account_summary: no private keys, no credentials, read-only
✓ check_transfer_eligibility: SCOPE_EXCEEDED error case works
✓ get_delegation_scope: scope query works

Run: node run-mcp-harness.mjs
```

## Architecture Diagram

```
AI Agent (Claude/ChatGPT)
        |
        v
MCP Server (Node.js)
        |
        +-- JSON Schema Validation
        |       |
        |       v
        |   [FAIL] -> SCHEMA_VALIDATION_FAILED
        |
        +-- Delegation Scope Check
                |
                v
        [OK] -> UNITS API Mock -> Response
        [DENY] -> SCOPE_EXCEEDED  <- THIS PROVES SAFETY
```

## Tool Contract Table

| Tool | Input | Safety Invariant | Error Path |
|---|---|---|---|
| `get_account_summary` | `accountId` | Read-only, no credentials | 404 if missing |
| `check_transfer_eligibility` | `amount, delegationScope` | No raw credentials | SCOPE_EXCEEDED |
| `get_delegation_scope` | `accountId` | Scope query only | 404 if missing |