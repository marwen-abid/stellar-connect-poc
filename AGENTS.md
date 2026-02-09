# Verification Steps (MANDATORY)

After ANY code change, run these verification steps in order.

## 1. Unit Tests
```bash
pnpm test
```
**Expected**: 169+ tests pass, exit code 0

**Breakdown**:
- Core: 70 tests
- Anchor: 77 tests
- SDK: 11 tests
- Signers: 11 tests

## 2. Build
```bash
pnpm build
```
**Expected**: Clean build, no TypeScript errors, exit code 0

## 3. Anchor Compliance Tests

### Start Server
```bash
cd examples/anchor-server
STELLAR_SIGNING_KEY=SBRVW5MTD2FGEQMYG77CAB5LYDVVNY7UOUOC2WUGPLUMRB5VJ27MSL2K \
JWT_SECRET=test-secret-key-minimum-32-characters-required-for-security \
PORT=8000 node dist/index.js
```

### Run Tests (in another terminal)
```bash
docker run --network host stellar/anchor-tests:latest \
  --home-domain http://localhost:8000 --seps 1 10 24
```
**Expected**: 55/55 tests pass, exit code 0

## Failure Debugging

### Unit Test Failure
1. Check error message in test output
2. Fix the failing test or code
3. Re-run `pnpm test` to verify fix

### Build Failure
1. Check TypeScript compilation errors
2. Fix type errors
3. Re-run `pnpm build`

### Anchor Test Failure
1. Check which SEP and test failed in output
2. Compare implementation to SEP specification
3. Check server logs for error details
4. Fix implementation
5. Re-run anchor tests
