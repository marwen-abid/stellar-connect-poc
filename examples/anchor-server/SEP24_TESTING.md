# SEP-24 Endpoint Testing Guide

## Prerequisites

Start the server:
```bash
cd examples/anchor-server
pnpm dev
```

## Generate Test JWT Token

```bash
cd examples/anchor-server && node -e "
const jwt = require('jsonwebtoken');
const secret = 'your-256-bit-secret-key-change-this-in-production';
const account = 'GBSEUVTEBSUCN543IPAUF26W4HQAKV42MRPMBO5IGIRPUQ5JJV7NACBK';
const token = jwt.sign({
  iss: 'localhost:8000',
  sub: account,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
}, secret);
console.log(token);
"
```

Set the token:
```bash
export JWT_TOKEN="<token from above>"
```

## Test Endpoints

### 1. Get SEP-24 Info (Unauthenticated)

```bash
curl -s http://localhost:8000/sep24/info | jq
```

Expected: Asset capabilities for native XLM with min/max amounts and fees.

### 2. Initiate Deposit

```bash
curl -s -X POST http://localhost:8000/sep24/transactions/deposit/interactive \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native","amount":"100"}' | jq
```

Expected: `{ id, url, type: "interactive_customer_info_needed" }`

Save the transaction ID and token:
```bash
DEPOSIT_RESPONSE=$(curl -s -X POST http://localhost:8000/sep24/transactions/deposit/interactive \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native","amount":"100"}')

TRANSACTION_ID=$(echo $DEPOSIT_RESPONSE | jq -r '.id')
TOKEN=$(echo $DEPOSIT_RESPONSE | jq -r '.url' | grep -oE 'token=[^&]*' | cut -d= -f2)
```

### 3. Access Interactive Page

Open in browser or curl:
```bash
curl -s "http://localhost:8000/interactive?transaction_id=$TRANSACTION_ID&token=$TOKEN" | head -20
```

Expected: HTML page with auto-complete flow.

### 4. Complete Interactive Flow

```bash
curl -s -X POST http://localhost:8000/interactive/complete \
  -H "Content-Type: application/json" \
  -d "{\"transaction_id\":\"$TRANSACTION_ID\",\"token\":\"$TOKEN\"}" | jq
```

Expected: `{ success: true, status: "pending_user_transfer_start", message: "..." }`

### 5. Check Transaction Status

```bash
curl -s "http://localhost:8000/sep24/transaction?id=$TRANSACTION_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq
```

Expected: Transaction details with updated status.

### 6. List All Transactions

```bash
curl -s "http://localhost:8000/sep24/transactions" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq
```

Expected: Array of transactions for the authenticated account.

### 7. Initiate Withdrawal

```bash
curl -s -X POST http://localhost:8000/sep24/transactions/withdraw/interactive \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native","amount":"50","dest":"bank_account_12345"}' | jq
```

Expected: `{ id, url, type: "interactive_customer_info_needed" }`

## Complete Flow Test

```bash
JWT_TOKEN="<your_token>"

# 1. Initiate deposit
DEPOSIT=$(curl -s -X POST http://localhost:8000/sep24/transactions/deposit/interactive \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native","amount":"200"}')

echo "Deposit initiated:"
echo $DEPOSIT | jq

# 2. Extract details
TRANSACTION_ID=$(echo $DEPOSIT | jq -r '.id')
TOKEN=$(echo $DEPOSIT | jq -r '.url' | grep -oE 'token=[^&]*' | cut -d= -f2)

# 3. Complete interactive flow
echo -e "\nCompleting interactive flow..."
curl -s -X POST http://localhost:8000/interactive/complete \
  -H "Content-Type: application/json" \
  -d "{\"transaction_id\":\"$TRANSACTION_ID\",\"token\":\"$TOKEN\"}" | jq

# 4. Check final status
echo -e "\nFinal status:"
curl -s "http://localhost:8000/sep24/transaction?id=$TRANSACTION_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq
```

## Expected Status Transitions

**Deposit:**
- Initial: `incomplete`
- After interactive complete: `pending_user_transfer_start`

**Withdrawal:**
- Initial: `incomplete`
- After interactive complete: `pending_anchor`

## Error Cases

### Missing Authentication
```bash
curl -s -X POST http://localhost:8000/sep24/transactions/deposit/interactive \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native"}' | jq
```
Expected: `{ error: "Missing authorization header" }`

### Missing Dest for Withdrawal
```bash
curl -s -X POST http://localhost:8000/sep24/transactions/withdraw/interactive \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"native"}' | jq
```
Expected: `{ error: "Missing required field: dest" }`

### Invalid Token
```bash
curl -s -X POST http://localhost:8000/interactive/complete \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"'$TRANSACTION_ID'","token":"invalid"}' | jq
```
Expected: `{ error: "Invalid token" }`

### Used Token (replay)
```bash
# Complete once (succeeds)
curl -s -X POST http://localhost:8000/interactive/complete \
  -H "Content-Type: application/json" \
  -d "{\"transaction_id\":\"$TRANSACTION_ID\",\"token\":\"$TOKEN\"}" | jq

# Try again (fails)
curl -s -X POST http://localhost:8000/interactive/complete \
  -H "Content-Type: application/json" \
  -d "{\"transaction_id\":\"$TRANSACTION_ID\",\"token\":\"$TOKEN\"}" | jq
```
Expected: `{ error: "Token already used" }`
