# API to MCP audit matrix

Status: starter matrix based on public specs. Final audit must use the private MCP server manifest/source when available.

| Public API / spec surface | Capability | Audit state | MCP exposure decision | Proposed MCP tool / action | Security concern | Evidence source | Test needed |
|---|---|---|---|---|---|---|
| `api/accounts-interfaces.yaml` | Current account profile and address data | partial | Expose scoped summary only | `get_account_summary` | PII masking, account scope | account profile / address endpoints | unit + integration |
| `api/accounts-interfaces.yaml` | Account keys | intentionally excluded | Expose public key summary only if needed | `get_account_summary` sub-surface | never expose private keys | account key endpoints | redaction snapshot |
| `api/delegations-interfaces.yaml` | List delegations | partial | Expose scoped delegation view | `get_delegation_scope` | over-broad delegation visibility | delegations/list | unit + integration |
| `api/delegations-interfaces.yaml` | Check effective delegation permission | partial | Expose policy precheck | `get_delegation_scope`, `check_transfer_eligibility` | server-side enforcement required | delegations/check | unit + integration |
| `api/token-interfaces.yaml` | Token holdings/search/get | partial | Expose scoped token summary | `get_account_summary` | token visibility under delegation | token get/search | unit + integration |
| `api/token-interfaces.yaml` | Token transfer dry-run | missing | Expose preflight | `check_transfer_eligibility` | side-effect free only | token transaction + delegation check | unit + e2e |
| `api/token-interfaces.yaml` | Token transfer commit | missing | Expose after preflight | `initiate_transfer` | highest-risk write path | token transact | integration + e2e |
| `api/token-interfaces.yaml` | Transaction status/history | partial | Expose scoped status/event subset | `subscribe_lifecycle_events` | broad history leak | transaction status/search | integration |
| `schemas/credential/v1/*` | Credential summary | partial | Expose metadata only | `get_account_summary` | raw claim leakage | credential schema | redaction snapshot |
| `schemas/credential/v1/*` | Verifiable Presentation | missing | Expose server-side VP operation | `present_credential_vp` | raw claim/proof leakage | credential schema, issue #749 | credential-flow tests |
| `schemas/transaction/v1/*` | Lifecycle / audit records | missing | Expose scoped events | `subscribe_lifecycle_events` | event stream overexposure | transaction schema | e2e event test |
| `api/key-management-interfaces.yaml` | Private key material | intentionally excluded | Do not expose | documented limitation | private key leak | key-management surface | negative audit row |
| `schemas/credential/v1/*` | Raw credential claims | intentionally excluded | Do not expose | documented limitation | privacy leak | credential schema | output scan |
| `api/token-interfaces.yaml` | Broad transaction history | intentionally excluded | Avoid initially; expose scoped event/status only | documented limitation or scoped tool | financial history leak | token/transaction APIs | permission tests |
| `api/client-interfaces.yaml` | Client registration/config operations | covered | Keep outside agent tooling by default | no MCP tool unless needed | tenant/config misuse | client API surface | authorization tests |
| `api/registry-interfaces.yaml` | Registry lookup/update operations | covered | Read-only only if needed | possible future read tool | cross-tenant data leak | registry API surface | permission tests |
| `api/adapter-interfaces.yaml` | Adapter execution surfaces | covered | Keep behind server boundary | documented exclusion unless scoped use case | arbitrary execution risk | adapter API surface | negative tests |

## Audit rule

Each row in final audit should include:

- audit state: `covered` / `partial` / `missing` / `intentionally excluded`
- outcome: new MCP tool, fix existing tool schema/error/response, or documented exclusion with rationale
- evidence path: MCP tool mapping or exclusion note
- proving test: unit / integration / e2e or negative security test
