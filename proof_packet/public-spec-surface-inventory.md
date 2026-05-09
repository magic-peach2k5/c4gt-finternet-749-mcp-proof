# Finternet #749 Public Spec Surface Inventory

Date: 2026-05-06

Source checked: `finternet-io/specs` on GitHub, default branch `main`.

This note connects the proposal audit matrix to the current public spec tree. It does not claim access to the private MCP server, and it does not prove a live UNITS dev-instance run.

## Repository Check

Verified with GitHub API:

```text
repo: finternet-io/specs
default branch: main
description: Open Schema and API Specifications
```

## Public API Files

| Public spec file | Audit bucket | Current MCP decision in proposal |
|---|---|---|
| `api/accounts-interfaces.yaml` | account read/profile/key surfaces | expose scoped account summary; never expose private keys |
| `api/adapter-interface.yaml` | adapter execution surface | keep behind UNITS boundary unless mentors define a scoped use case |
| `api/clients-interfaces.yaml` | client registration/config | exclude from initial MCP tools by default |
| `api/delegations-interfaces.yaml` | delegation listing/checking | expose scoped delegation view and policy precheck |
| `api/key-management-interfaces.yaml` | key-management surface | document exclusion for private key material |
| `api/registry-interfaces.yaml` | registry lookup/update | read-only future surface if needed; not core midpoint |
| `api/token-class-config-interfaces.yaml` | token class config | audit as token configuration; likely excluded from agent writes unless scoped |
| `api/token-interfaces.yaml` | token holdings, transfer, transaction status | expose summaries, preflight, guarded transfer, scoped lifecycle status |

Count: 8 API YAML files plus `api/README.md`.

## Public Schema Roots

Verified schema roots:

```text
schemas/account
schemas/core
schemas/credential
schemas/token-class
schemas/token
schemas/transaction
```

Checked schema subfolders/files:

| Schema root | Files observed | Proposal use |
|---|---|---|
| `schemas/account` | `account.jsonld`, `account.schema.json`, `v1/` | account summary shape, redaction tests |
| `schemas/credential` | `credential.jsonld`, `credential.schema.json`, `v1/` | VP workflow without raw claim exposure |
| `schemas/token` | `token.jsonld`, `token.schema.json`, `v1/` | token summary and transfer eligibility context |
| `schemas/transaction` | `audit-event.jsonld`, `audit-event.schema.json`, `token-transaction.jsonld`, `token-transaction.schema.json`, `transaction-log.jsonld`, `transaction-log.schema.json`, `v1/` | lifecycle event, transfer result, and audit-log outputs |

## Gap Mapping Summary

| Audit state | Public surfaces | Reason |
|---|---|---|
| `partial` | accounts, delegations, token holdings/status, credential metadata | MCP can expose scoped summaries, but private repo mapping is still unknown |
| `missing` | transfer preflight, guarded transfer commit, VP presentation, lifecycle subscription | these map to issue-named tools and need implementation/tests |
| `intentionally excluded` | private keys, raw credential claims, broad transaction history, client/config writes, adapter execution | these are unsafe or too broad for agent tools unless mentors define narrower delegation rules |
| `pending private audit` | current MCP manifest/source | private MCP repo is not public yet |

## Reviewer Use

Use this file with:

- `api-to-mcp-audit-matrix.md`
- `tool-schemas/*.schema.json`
- `tool-schemas-output/*.output.schema.json`
- `examples/scope-exceeded.response.json`
- `mcp-inspector-test-plan.md`

Together, these files show that the six proposed tools are based on the public API/spec surface and that unsafe surfaces are excluded deliberately, not forgotten.

