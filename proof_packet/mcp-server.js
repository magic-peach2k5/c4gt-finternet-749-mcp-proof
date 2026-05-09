/**
 * Finternet Local MCP Server - implements public spec UNITS API tools
 * Serves delegation scope, account summary, transfer preflight/init, credential VP, lifecycle events
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolSchema,
  ListToolsSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Delegation data
const delegation = {
  id: 'del_public_spec_001',
  delegatorAccountAddress: 'did:finternet:account:treasury',
  delegateeAccountAddress: 'did:finternet:account:agent',
  allowedTokenClasses: ['USD_UNIT', 'INR_UNIT'],
  dailyLimit: 1000,
  spentToday: 250,
  expiresAt: '2026-06-01T00:00:00.000Z',
  status: 'active',
};

// Schema for required fields per tool
const schemaRequiredFields = {
  get_delegation_scope: ['requestId', 'actingAccountAddress', 'delegatorAccountAddress', 'delegateeAccountAddress', 'delegationCredentialChain', 'operation'],
  get_account_summary: ['requestId', 'actingAccountAddress', 'accountAddress', 'delegationCredentialChain'],
  check_transfer_eligibility: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'fromAccount', 'toAccount', 'tokenClass', 'amount'],
  initiate_transfer: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'preflightId', 'fromAccount', 'toAccount', 'tokenClass', 'amount'],
  subscribe_lifecycle_events: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'accountAddress', 'eventTypes'],
  present_credential_vp: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'accountAddress', 'policyRequirementId'],
};

function domainError(code, message, detail = {}) {
  return { ok: false, error: { code, message, detail } };
}

function validate(tool, input) {
  const required = schemaRequiredFields[tool] || [];
  const missing = required.filter((field) => input[field] === undefined || input[field] === '');
  if (missing.length) {
    return domainError('VALIDATION_ERROR', `Missing required field(s): ${missing.join(', ')}`, { missing });
  }
  if (input.amount && !/^[0-9]+(\.[0-9]+)?$/.test(input.amount)) {
    return domainError('VALIDATION_ERROR', 'Amount must be a decimal string.', { amount: input.amount });
  }
  return { ok: true };
}

function checkScope(input) {
  if (input.actingAccountAddress !== delegation.delegateeAccountAddress) {
    return domainError('SCOPE_EXCEEDED', 'Acting account is not delegated.', {
      requested: input.actingAccountAddress,
      allowed: delegation.delegateeAccountAddress,
    });
  }
  if (input.accountAddress && input.accountAddress !== delegation.delegatorAccountAddress) {
    return domainError('SCOPE_EXCEEDED', 'Delegation does not cover requested account.', {
      requested: input.accountAddress,
      allowed: delegation.delegatorAccountAddress,
    });
  }
  if (input.fromAccount && input.fromAccount !== delegation.delegatorAccountAddress) {
    return domainError('SCOPE_EXCEEDED', 'Delegation does not cover transfer source account.', {
      requested: input.fromAccount,
      allowed: delegation.delegatorAccountAddress,
    });
  }
  if (input.tokenClass && !delegation.allowedTokenClasses.includes(input.tokenClass)) {
    return domainError('SCOPE_EXCEEDED', 'Token class outside delegation scope.', {
      requested: input.tokenClass,
      allowed: delegation.allowedTokenClasses,
    });
  }
  if (input.amount && Number(input.amount) + delegation.spentToday > delegation.dailyLimit) {
    return domainError('SCOPE_EXCEEDED', 'Transfer would exceed daily delegated amount.', {
      requested: Number(input.amount),
      remainingDailyLimit: delegation.dailyLimit - delegation.spentToday,
    });
  }
  return { ok: true };
}

// Tool handlers
const preflights = new Map();
let preflightCounter = 0;

const handlers = {
  get_delegation_scope: (input) => {
    const valid = validate('get_delegation_scope', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) return scoped;
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'OK',
        delegationId: delegation.id,
        allowedTokenClasses: delegation.allowedTokenClasses,
        amountLimits: [{ tokenClass: 'USD_UNIT', maxAmount: '1000', period: '1d' }],
        expiresAt: delegation.expiresAt,
        audit: { rawClaimsExposed: false, actingAccountAddress: input.actingAccountAddress },
      },
    };
  },

  get_account_summary: (input) => {
    const valid = validate('get_account_summary', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) return scoped;
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'OK',
        accountAddress: delegation.delegatorAccountAddress,
        nativeTokenHoldings: [{ tokenClass: 'USD_UNIT', balance: '1800' }],
        activeDelegations: [{ delegationId: delegation.id, scopeSummary: 'USD_UNIT/INR_UNIT transfer preflight, daily limit 1000' }],
        credentialStoreSummary: [{ credentialType: 'DelegatedTransferAuthority', issuer: 'did:finternet:issuer:demo', rawClaimValuesExposed: false }],
      },
    };
  },

  check_transfer_eligibility: (input) => {
    const valid = validate('check_transfer_eligibility', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) {
      return {
        ok: true,
        data: {
          requestId: input.requestId,
          resultCode: 'SCOPE_EXCEEDED',
          eligible: false,
          errors: [scoped.error],
        },
      };
    }
    const preflightId = `preflight_public_spec_${++preflightCounter}`;
    preflights.set(preflightId, input);
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'OK',
        eligible: true,
        preflightId,
        scopeCheck: { passed: true, reason: 'delegation active and within daily token limit' },
        credentialChecks: [{ credentialType: 'DelegatedTransferAuthority', passed: true, rawClaimValuesExposed: false }],
        errors: [],
      },
    };
  },

  present_credential_vp: (input) => {
    const valid = validate('present_credential_vp', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) return scoped;
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'OK',
        vpId: 'vp_public_spec_001',
        policyRequirementId: input.policyRequirementId,
        rawClaimValuesExposed: false,
      },
    };
  },

  initiate_transfer: (input) => {
    const valid = validate('initiate_transfer', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) return scoped;
    if (!preflights.has(input.preflightId)) {
      return domainError('PREFLIGHT_REQUIRED', 'check_transfer_eligibility must pass before initiate_transfer.', {
        missing: 'known preflightId',
      });
    }
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'ACCEPTED',
        transferId: 'transfer_public_spec_001',
        status: 'accepted',
        preflightId: input.preflightId,
        auditLogRedacted: true,
      },
    };
  },

  subscribe_lifecycle_events: (input) => {
    const valid = validate('subscribe_lifecycle_events', input);
    if (!valid.ok) return valid;
    const scoped = checkScope(input);
    if (!scoped.ok) return scoped;
    return {
      ok: true,
      data: {
        requestId: input.requestId,
        resultCode: 'OK',
        subscriptionId: 'sub_public_spec_001',
        eventTypes: input.eventTypes,
        scopedToAccount: input.accountAddress,
      },
    };
  },
};

// MCP Server setup
const server = new Server(
  {
    name: 'finternet-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsSchema, async () => {
  return {
    tools: [
      {
        name: 'get_delegation_scope',
        description: 'Get delegation scope for an account',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            delegatorAccountAddress: { type: 'string', description: 'Delegator account address' },
            delegateeAccountAddress: { type: 'string', description: 'Delegatee account address' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
            operation: { type: 'string', description: 'Operation type (e.g., transfer)' },
            tokenClass: { type: 'string', description: 'Token class (optional)' },
          },
          required: ['requestId', 'actingAccountAddress', 'delegatorAccountAddress', 'delegateeAccountAddress', 'delegationCredentialChain', 'operation'],
        },
      },
      {
        name: 'get_account_summary',
        description: 'Get account summary including holdings and delegations',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            accountAddress: { type: 'string', description: 'Account address to query' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
          },
          required: ['requestId', 'actingAccountAddress', 'accountAddress', 'delegationCredentialChain'],
        },
      },
      {
        name: 'check_transfer_eligibility',
        description: 'Check if a transfer is eligible (preflight)',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
            fromAccount: { type: 'string', description: 'Source account address' },
            toAccount: { type: 'string', description: 'Destination account address' },
            tokenClass: { type: 'string', description: 'Token class' },
            amount: { type: 'string', description: 'Amount as decimal string' },
            purpose: { type: 'string', description: 'Transfer purpose (optional)' },
          },
          required: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'fromAccount', 'toAccount', 'tokenClass', 'amount'],
        },
      },
      {
        name: 'initiate_transfer',
        description: 'Initiate a transfer after preflight check',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
            preflightId: { type: 'string', description: 'Preflight ID from eligibility check' },
            fromAccount: { type: 'string', description: 'Source account address' },
            toAccount: { type: 'string', description: 'Destination account address' },
            tokenClass: { type: 'string', description: 'Token class' },
            amount: { type: 'string', description: 'Amount as decimal string' },
          },
          required: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'preflightId', 'fromAccount', 'toAccount', 'tokenClass', 'amount'],
        },
      },
      {
        name: 'present_credential_vp',
        description: 'Present a verifiable presentation for credential',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
            accountAddress: { type: 'string', description: 'Account address' },
            policyRequirementId: { type: 'string', description: 'Policy requirement ID' },
            preflightId: { type: 'string', description: 'Preflight ID (optional)' },
          },
          required: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'accountAddress', 'policyRequirementId'],
        },
      },
      {
        name: 'subscribe_lifecycle_events',
        description: 'Subscribe to account lifecycle events',
        inputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string', description: 'Request identifier' },
            actingAccountAddress: { type: 'string', description: 'Acting account address' },
            delegationCredentialChain: { type: 'string', description: 'Delegation credential chain' },
            accountAddress: { type: 'string', description: 'Account address' },
            eventTypes: { type: 'array', items: { type: 'string' }, description: 'Event types to subscribe' },
            tokenClasses: { type: 'array', items: { type: 'string' }, description: 'Token classes (optional)' },
          },
          required: ['requestId', 'actingAccountAddress', 'delegationCredentialChain', 'accountAddress', 'eventTypes'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolSchema, async (request) => {
  const { name, arguments: args } = request;
  const handler = handlers[name];

  if (!handler) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(domainError('UNKNOWN_TOOL', `Unknown tool: ${name}`, { tool: name })),
        },
      ],
    };
  }

  try {
    const result = handler(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(domainError('INTERNAL_ERROR', error.message, { stack: error.stack })),
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Export for testing
export { handlers, validate, checkScope, domainError, delegation, preflights };