const assert = require('node:assert/strict');

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
  const missing = schemaRequiredFields[tool].filter((field) => input[field] === undefined || input[field] === '');
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

const preflights = new Map();
const base = {
  requestId: 'req-public-spec',
  actingAccountAddress: delegation.delegateeAccountAddress,
  delegationCredentialChain: 'demo-chain-redacted',
};

const tools = {
  get_delegation_scope(input) {
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
  get_account_summary(input) {
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
  check_transfer_eligibility(input) {
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
    const preflightId = 'preflight_public_spec_001';
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
  present_credential_vp(input) {
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
  initiate_transfer(input) {
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
  subscribe_lifecycle_events(input) {
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

const calls = [
  ['get_delegation_scope', {
    ...base,
    requestId: 'req-scope',
    delegatorAccountAddress: delegation.delegatorAccountAddress,
    delegateeAccountAddress: delegation.delegateeAccountAddress,
    operation: 'transfer',
    tokenClass: 'USD_UNIT',
  }],
  ['get_account_summary', {
    ...base,
    requestId: 'req-account',
    accountAddress: delegation.delegatorAccountAddress,
  }],
  ['check_transfer_eligibility', {
    ...base,
    requestId: 'req-preflight-pass',
    fromAccount: delegation.delegatorAccountAddress,
    toAccount: 'did:finternet:account:merchant',
    tokenClass: 'USD_UNIT',
    amount: '100',
    purpose: 'demo transfer',
  }],
  ['check_transfer_eligibility', {
    ...base,
    requestId: 'req-preflight-fail',
    fromAccount: delegation.delegatorAccountAddress,
    toAccount: 'did:finternet:account:merchant',
    tokenClass: 'USD_UNIT',
    amount: '900',
    purpose: 'scope failure demo',
  }],
  ['present_credential_vp', {
    ...base,
    requestId: 'req-vp',
    accountAddress: delegation.delegatorAccountAddress,
    policyRequirementId: 'kyc-lite',
    preflightId: 'preflight_public_spec_001',
  }],
  ['initiate_transfer', {
    ...base,
    requestId: 'req-transfer',
    preflightId: 'preflight_public_spec_001',
    fromAccount: delegation.delegatorAccountAddress,
    toAccount: 'did:finternet:account:merchant',
    tokenClass: 'USD_UNIT',
    amount: '100',
  }],
  ['subscribe_lifecycle_events', {
    ...base,
    requestId: 'req-events',
    accountAddress: delegation.delegatorAccountAddress,
    eventTypes: ['transfer_committed', 'delegation_revoked'],
    tokenClasses: ['USD_UNIT'],
  }],
];

const transcript = calls.map(([tool, input]) => ({ tool, input, result: tools[tool](input) }));

assert.deepEqual(Object.keys(schemaRequiredFields), [
  'get_delegation_scope',
  'get_account_summary',
  'check_transfer_eligibility',
  'initiate_transfer',
  'subscribe_lifecycle_events',
  'present_credential_vp',
]);
assert.equal(transcript[2].result.data.eligible, true);
assert.equal(transcript[3].result.data.resultCode, 'SCOPE_EXCEEDED');
assert.equal(transcript[4].result.data.rawClaimValuesExposed, false);
assert.equal(transcript[5].result.data.resultCode, 'ACCEPTED');

console.log(JSON.stringify({
  status: 'pass',
  tools: Object.keys(schemaRequiredFields),
  transcript,
  inspectorPlan: [
    'wrap these handlers in a stdio MCP server after public repo setup',
    'run: npx @modelcontextprotocol/inspector node proof_packet/mock-mcp-server.js',
    'exercise scope success, scope-exceeded, VP redaction, transfer preflight, lifecycle subscription',
  ],
  caveat: 'Public-spec mock only. No private UNITS MCP server, real UNITS API, or production transfer was called.',
}, null, 2));
