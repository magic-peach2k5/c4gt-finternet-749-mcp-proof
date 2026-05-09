import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "tool-schemas", "check_transfer_eligibility.schema.json");
const outputPath = join(here, "mock-mcp-runtime-output.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const required = schema.required ?? [];

function validateRequired(input) {
  const missing = required.filter((field) => input[field] === undefined || input[field] === null);
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Required MCP tool input fields are missing.",
        missing,
      },
    };
  }
  return { ok: true };
}

function checkTransferEligibility(input) {
  const validation = validateRequired(input);
  if (!validation.ok) return validation;

  const amount = Number(input.amount);
  const maxAmount = Number(input.delegationScope?.maxAmount ?? 0);

  if (Number.isFinite(amount) && Number.isFinite(maxAmount) && amount > maxAmount) {
    return {
      ok: false,
      error: {
        code: "SCOPE_EXCEEDED",
        message: "Requested transfer exceeds delegated amount.",
        requestedAmount: input.amount,
        maxDelegatedAmount: input.delegationScope.maxAmount,
        recoverable: true,
      },
      audit: {
        tool: "check_transfer_eligibility",
        sideEffectFree: true,
        privateKeysExposed: false,
        rawCredentialClaimsExposed: false,
      },
    };
  }

  return {
    ok: true,
    result: {
      eligible: true,
      reason: "Delegation scope allows this side-effect-free preflight.",
      requiredNextStep: "initiate_transfer may be called only with matching preflightId.",
      preflightId: "preflight_demo_001",
    },
    audit: {
      tool: "check_transfer_eligibility",
      sideEffectFree: true,
      privateKeysExposed: false,
      rawCredentialClaimsExposed: false,
    },
  };
}

const cases = [
  {
    name: "valid eligibility preflight",
    input: {
      requestId: "req_preflight_001",
      actingAccountAddress: "did:finternet:account:agent",
      fromAccount: "did:finternet:account:treasury",
      toAccount: "did:finternet:account:merchant",
      tokenClass: "INR_UNIT",
      amount: "75",
      delegationCredentialChain: "delegation_chain_ref_demo",
      delegationScope: { maxAmount: "100", allowedTokenIds: ["INR_UNIT"] },
    },
  },
  {
    name: "scope exceeded preflight",
    input: {
      requestId: "req_preflight_002",
      actingAccountAddress: "did:finternet:account:agent",
      fromAccount: "did:finternet:account:treasury",
      toAccount: "did:finternet:account:merchant",
      tokenClass: "INR_UNIT",
      amount: "150",
      delegationCredentialChain: "delegation_chain_ref_demo",
      delegationScope: { maxAmount: "100", allowedTokenIds: ["INR_UNIT"] },
    },
  },
];

const output = {
  proofType: "synthetic local MCP-style harness",
  issue: "Finternet #749",
  privateMcpServerClaimed: false,
  schemaPath: "tool-schemas/check_transfer_eligibility.schema.json",
  cases: cases.map((item) => ({
    name: item.name,
    input: item.input,
    output: checkTransferEligibility(item.input),
  })),
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));