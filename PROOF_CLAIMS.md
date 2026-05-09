# Proof of Work — P3 Finternet #749

**Project:** Delegation-Scoped MCP Server for Safe Agent Access to the UNITS API  
**DMP:** https://github.com/Code4GovTech/C4GT/issues/749  
**Proof repo:** https://github.com/magic-peach2k5/c4gt-finternet-749-mcp-proof  

## Claim Boundary
Local public-spec-shaped proof only. No private UNITS repo or dev instance integration is claimed.

## Proof Artifacts

### mcp-server.js
A minimal Node.js MCP server demonstrating:
- 6 scoped tool definitions (read, preflight, inspect, subscribe, guarded write)
- Schema validation for each tool input
- Delegation scope checking before write operations
- Structured error taxonomy (policy failure vs transport failure)
- Credential redaction in response summaries

### mcp-server.test.standalone.js
15 standalone tests covering:
- Valid scope: tool executes with correct response shape
- Scope exceeded: tool returns policy error without executing
- Malformed input: tool returns validation error with stable code
- Credential redaction: sensitive fields replaced with safe summaries
- Preflight-before-write: write tool rejects without preflight
- Structured error output: all errors include stable code + message

### MCP Tool Contract
Documented tool contract mapping:
- Tool names and input schemas
- Output shapes for each tool
- Error codes and messages
- Delegation scope requirements per tool

### Audit Matrix
Matrix mapping each tool back to public API concepts from UNITS specs.

### Synthetic Transcript
A transcript showing an agent using the MCP server with scoped tools and structured errors.

### Screenshots
Screenshots of:
- MCP inspector output showing tool definitions
- Test runner output showing all 15 tests passing
- Tool call example with structured error response

## Upgrade Path
Next: Make the public-spec inventory the lead evidence and publish the proof packet only when public sharing is approved.
