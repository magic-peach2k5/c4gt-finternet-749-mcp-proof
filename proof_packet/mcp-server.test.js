/**
 * Tests for Finternet MCP Server handlers
 * Tests scope checking, validation, preflight/transfer flow, VP redaction
 */
import assert from 'node:assert/strict';
import { handlers, validate, checkScope, domainError } from './mcp-server.js';

// Test data
const baseInput = {
  requestId: 'test-req-001',
  actingAccountAddress: 'did:finternet:account:agent',
  delegationCredentialChain: 'test-chain',
};

const validScopeInput = {
  ...baseInput,
  requestId: 'test-scope',
  delegatorAccountAddress: 'did:finternet:account:treasury',
  delegateeAccountAddress: 'did:finternet:account:agent',
  operation: 'transfer',
};

const validAccountInput = {
  ...baseInput,
  requestId: 'test-account',
  accountAddress: 'did:finternet:account:treasury',
};

const validTransferInput = {
  ...baseInput,
  requestId: 'test-transfer',
  fromAccount: 'did:finternet:account:treasury',
  toAccount: 'did:finternet:account:merchant',
  tokenClass: 'USD_UNIT',
  amount: '100',
};

console.log('Running Finternet MCP Server tests...\n');

// Test 1: Validation - missing required fields
{
  const result = validate('get_delegation_scope', { requestId: 'req' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  console.log('✓ Test 1: Validation rejects missing fields');
}

// Test 2: Validation - invalid amount format
{
  const result = validate('check_transfer_eligibility', {
    ...validTransferInput,
    amount: 'not-a-number',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  console.log('✓ Test 2: Validation rejects invalid amount');
}

// Test 3: Scope - wrong acting account
{
  const result = checkScope({
    ...validScopeInput,
    actingAccountAddress: 'did:finternet:account:attacker',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SCOPE_EXCEEDED');
  console.log('✓ Test 3: Scope rejects wrong acting account');
}

// Test 4: Scope - unauthorized account access
{
  const result = checkScope({
    ...validAccountInput,
    accountAddress: 'did:finternet:account:unauthorized',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SCOPE_EXCEEDED');
  console.log('✓ Test 4: Scope rejects unauthorized account access');
}

// Test 5: Scope - unauthorized token class
{
  const result = checkScope({
    ...validTransferInput,
    tokenClass: 'EUR_UNIT',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SCOPE_EXCEEDED');
  assert.ok(result.error.detail.allowed.includes('USD_UNIT'));
  console.log('✓ Test 5: Scope rejects unauthorized token class');
}

// Test 6: Scope - exceeds daily limit
{
  const result = checkScope({
    ...validTransferInput,
    amount: '900',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SCOPE_EXCEEDED');
  console.log('✓ Test 6: Scope rejects transfer exceeding daily limit');
}

// Test 7: get_delegation_scope - success
{
  const result = handlers.get_delegation_scope(validScopeInput);
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'OK');
  assert.equal(result.data.delegationId, 'del_public_spec_001');
  assert.equal(result.data.audit.rawClaimsExposed, false);
  console.log('✓ Test 7: get_delegation_scope returns scope with redaction');
}

// Test 8: get_account_summary - success
{
  const result = handlers.get_account_summary(validAccountInput);
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'OK');
  assert.equal(result.data.accountAddress, 'did:finternet:account:treasury');
  assert.ok(result.data.nativeTokenHoldings);
  assert.equal(result.data.credentialStoreSummary[0].rawClaimValuesExposed, false);
  console.log('✓ Test 8: get_account_summary returns holdings with VP redaction');
}

// Test 9: check_transfer_eligibility - success
{
  const result = handlers.check_transfer_eligibility(validTransferInput);
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'OK');
  assert.equal(result.data.eligible, true);
  assert.ok(result.data.preflightId);
  assert.equal(result.data.credentialChecks[0].rawClaimValuesExposed, false);
  const preflightId = result.data.preflightId;
  
  // Test 10: initiate_transfer with valid preflight
  const transferResult = handlers.initiate_transfer({
    ...baseInput,
    requestId: 'test-transfer-complete',
    preflightId,
    fromAccount: 'did:finternet:account:treasury',
    toAccount: 'did:finternet:account:merchant',
    tokenClass: 'USD_UNIT',
    amount: '100',
  });
  assert.equal(transferResult.ok, true);
  assert.equal(transferResult.data.resultCode, 'ACCEPTED');
  assert.equal(transferResult.data.auditLogRedacted, true);
  console.log('✓ Test 9-10: Preflight → Transfer flow succeeds with audit redaction');
}

// Test 11: check_transfer_eligibility - scope exceeded
{
  const result = handlers.check_transfer_eligibility({
    ...validTransferInput,
    requestId: 'test-fail',
    amount: '900',
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'SCOPE_EXCEEDED');
  assert.equal(result.data.eligible, false);
  assert.ok(result.data.errors.length > 0);
  console.log('✓ Test 11: Preflight returns SCOPE_EXCEEDED with errors');
}

// Test 12: initiate_transfer - missing preflight
{
  const result = handlers.initiate_transfer({
    ...baseInput,
    requestId: 'test-no-preflight',
    preflightId: 'fake-preflight-id',
    fromAccount: 'did:finternet:account:treasury',
    toAccount: 'did:finternet:account:merchant',
    tokenClass: 'USD_UNIT',
    amount: '100',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PREFLIGHT_REQUIRED');
  console.log('✓ Test 12: initiate_transfer rejects missing preflight');
}

// Test 13: present_credential_vp - success
{
  const result = handlers.present_credential_vp({
    ...baseInput,
    requestId: 'test-vp',
    accountAddress: 'did:finternet:account:treasury',
    policyRequirementId: 'kyc-lite',
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'OK');
  assert.equal(result.data.rawClaimValuesExposed, false);
  console.log('✓ Test 13: present_credential_vp returns VP with redaction');
}

// Test 14: subscribe_lifecycle_events - success
{
  const result = handlers.subscribe_lifecycle_events({
    ...baseInput,
    requestId: 'test-events',
    accountAddress: 'did:finternet:account:treasury',
    eventTypes: ['transfer_committed', 'delegation_revoked'],
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.resultCode, 'OK');
  assert.equal(result.data.subscriptionId, 'sub_public_spec_001');
  assert.equal(result.data.scopedToAccount, 'did:finternet:account:treasury');
  console.log('✓ Test 14: subscribe_lifecycle_events returns subscription');
}

// Test 15: All tools enforce rawClaimValuesExposed = false
{
  const scopeResult = handlers.get_delegation_scope(validScopeInput);
  const accountResult = handlers.get_account_summary(validAccountInput);
  const vpResult = handlers.present_credential_vp({
    ...baseInput,
    requestId: 'test-vp-2',
    accountAddress: 'did:finternet:account:treasury',
    policyRequirementId: 'kyc-lite',
  });
  
  assert.equal(scopeResult.data.audit?.rawClaimsExposed, false);
  assert.equal(accountResult.data.credentialStoreSummary[0].rawClaimValuesExposed, false);
  assert.equal(accountResult.data.activeDelegations[0]?.rawClaimValuesExposed, undefined);
  assert.equal(vpResult.data.rawClaimValuesExposed, false);
  console.log('✓ Test 15: All responses enforce raw claim value redaction');
}

console.log('\n✅ All 15 tests passed!');
console.log('\nProof: Local MCP server with delegation scope checking, preflight/transfer flow, VP redaction, and lifecycle subscriptions verified.');