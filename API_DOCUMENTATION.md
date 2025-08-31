# Promo Code API Documentation

## Overview
Your promo code management system uses **Bearer token authentication** for security. The system supports both temporary session tokens and permanent API tokens for different use cases.

## Authentication

### 🔐 Authentication Methods

**1. Temporary Session Tokens (Web UI)**
- **Duration**: 24 hours
- **Use Case**: Web application login sessions
- **How to Get**: Login with API key via `/api/auth/login`

**2. Permanent API Tokens (Automation & Integrations)**
- **Duration**: Never expire (until manually deleted)
- **Use Case**: n8n, Zapier, custom integrations, API automation
- **How to Get**: Generate via web UI "API Tokens" section
- **Format**: `sk-[48-character-hex-string]`

### 🔑 Making Authenticated Requests

**All API requests** (except login) must include:
```http
Authorization: Bearer <your-token-here>
```

### 🚀 Getting Started

**For Web Applications:**
1. Login via `/api/auth/login` with your API key
2. Use the returned temporary token for subsequent requests

**For Automation Tools (n8n, Zapier, etc.):**
1. Generate a permanent token via the web UI
2. Use that token directly in your automation workflows
3. Store it securely in your tool's credential management

---

## 🔐 Authentication Endpoints

### Login (Get Temporary Token)
**POST** `/api/auth/login`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "apiKey": "your-secure-api-key-here"
}
```

**Response:**
```json
{
  "token": "temporary-bearer-token-here",
  "expiresIn": 86400
}
```

### Token Management

#### Get All API Tokens
**GET** `/api/tokens`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

#### Create New Permanent Token
**POST** `/api/tokens`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "name": "n8n Integration"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "n8n Integration", 
  "token": "sk-abc123...",
  "createdAt": "2025-01-31T14:30:00Z",
  "lastUsedAt": null
}
```

#### Delete API Token
**DELETE** `/api/tokens/{id}`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

---

## 📝 Promo Code Endpoints

### 1. Generate Single Promo Code
**POST** `/api/promo-codes/generate`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "format": "PROMO-XXXX",
  "campaignName": "Summer Sale",
  "discountValue": "20% off",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "code": "PROMO-A1B2",
  "status": "unused",
  "campaignName": "Summer Sale",
  "discountValue": "20% off",
  "createdAt": "2025-01-31T14:30:00Z",
  "usedAt": null,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

### 2. Generate Bulk Promo Codes
**POST** `/api/promo-codes/bulk-generate`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "count": 10,
  "format": "SAVE-XXXX-XX",
  "campaignName": "Holiday Sale",
  "discountValue": "15% off",
  "expiresAt": "2025-12-25T23:59:59Z"
}
```

### 3. Generate Campaign Codes
**POST** `/api/promo-codes/generate-campaign`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "campaignName": "Holiday Special",
  "discountValue": "$10 off",
  "count": 50,
  "format": "HOLIDAY-XXXXXX",
  "expiresAt": "2025-12-25T23:59:59Z"
}
```

### 4. Get All Promo Codes
**GET** `/api/promo-codes`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

**Query Parameters:**
- `page` - Page number for pagination (optional)
- `limit` - Items per page (optional, max 1000)
- `search` - Search codes or campaigns (optional)
- `campaign` - Filter by campaign name (optional)
- `status` - Filter by status: unused, used, expired (optional)
- `export=all` - Download all codes (ignores pagination)

### 5. Get Promo Code Statistics
**GET** `/api/promo-codes/stats`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

**Response:**
```json
{
  "total": 1000,
  "used": 250,
  "available": 700,
  "expired": 50
}
```

### 6. Redeem Promo Code
**POST** `/api/promo-codes/redeem`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "code": "PROMO-A1B2"
}
```

### 7. Delete Single Code
**DELETE** `/api/promo-codes/{code}`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

### 8. Delete Multiple Codes
**DELETE** `/api/promo-codes`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "codes": ["PROMO-A1B2", "PROMO-C3D4", "PROMO-E5F6"]
}
```

### 9. Import Promo Codes from CSV
**POST** `/api/promo-codes/import`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your-token>"
}
```

**Request Body:**
```json
{
  "codes": [
    {
      "code": "PROMO-A1B2",
      "status": "unused",
      "campaignName": "Summer Sale",
      "discountValue": "20% off",
      "expiresAt": "2025-12-31T23:59:59Z"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Import completed: 5 imported, 2 skipped",
  "imported": 5,
  "skipped": 2,
  "errors": []
}
```

---

## 🎯 Code Generation Formats

### Understanding the Format System
- Each `X` in the format gets replaced with a random character (A-Z, 0-9)
- **36 possible characters** per `X` position
- **Prefix text** stays exactly as written

### Available Formats & Capacity:

| Format | Example Output | Total Possible Codes | Best For |
|--------|---------------|---------------------|----------|
| `PROMO-XXXX` | PROMO-A1B2 | **1,679,616** | Small businesses |
| `SAVE-XXXX-XX` | SAVE-A1B2-C3 | **47,176,896** | Medium campaigns |
| `DISCOUNT-XXXXXX` | DISCOUNT-A1B2C3 | **2.1 billion** | Large campaigns |
| `REST2024-XXXX` | REST2024-A1B2 | **1,679,616** | Year-specific |
| `XXXXXXXXXX` | A1B2C3D4E5 | **3.6 quadrillion** | Enterprise scale |

### Custom Format Examples:
- `WINTER2025-XXX` → WINTER2025-A1B
- `50OFF-XXXXXX` → 50OFF-A1B2C3
- `XXX-XXX-XXX` → A1B-C2D-E3F

---

## 🚀 Testing Your API Requests

### Using cURL with Permanent Token:
```bash
# Generate a single code
curl -X POST https://your-domain.com/api/promo-codes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-permanent-token-here" \
  -d '{
    "format": "TEST-XXXX",
    "campaignName": "Test Campaign",
    "discountValue": "10% off"
  }'
```

### Using cURL with Temporary Token:
```bash
# 1. Login first
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}'

# 2. Use the returned token
curl -X POST https://your-domain.com/api/promo-codes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer temporary-token-from-login" \
  -d '{
    "format": "TEST-XXXX",
    "campaignName": "Test Campaign",
    "discountValue": "10% off"
  }'
```

### Using JavaScript fetch:
```javascript
// Using permanent token (recommended for automation)
const response = await fetch('/api/promo-codes/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-your-permanent-token-here'
  },
  body: JSON.stringify({
    format: 'PROMO-XXXX',
    campaignName: 'My Campaign',
    discountValue: '15% off'
  })
});

const data = await response.json();
console.log(data);
```

### n8n Integration Example:
```javascript
// In n8n HTTP Request Node:
// Method: POST
// URL: {{$env.PROMO_API_URL}}/api/promo-codes/generate
// Headers: 
//   Authorization: Bearer {{$env.PROMO_API_TOKEN}}
//   Content-Type: application/json
// Body:
{
  "format": "PROMO-XXXX",
  "campaignName": "n8n Generated",
  "discountValue": "{{$json.discount}}"
}
```

---

## ⚠️ Important Security Guidelines

### 🔒 Token Security
- **Never commit tokens to version control**
- **Store tokens in secure credential management** (n8n credentials, environment variables)
- **Use descriptive names** when creating tokens to track usage
- **Delete unused tokens** immediately
- **Monitor token usage** via lastUsedAt timestamps

### 🛡️ Best Practices
1. **Use permanent tokens for automation** - they won't expire unexpectedly
2. **Use temporary tokens for web sessions** - they auto-expire for better security
3. **Implement rate limiting** if you have high-traffic scenarios
4. **Use HTTPS** in production environments
5. **Validate responses** and handle errors gracefully

### 🚨 Common Issues & Solutions

**"Unauthorized: Invalid token"**
- Check that your token is correctly formatted
- Ensure you're using `Authorization: Bearer <token>` header format
- Verify the token hasn't been deleted
- For temporary tokens, check if it has expired (24h limit)

**"Token not found"**
- The permanent token may have been deleted from the UI
- Generate a new permanent token if needed

---

## 📊 Environment Configuration

### For Development:
```bash
API_KEY=your-secure-api-key-here
DATABASE_URL=your-postgresql-connection-string
```

### For Production (Cloudflare Workers):
```bash
API_KEY=your-secure-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 🆕 New Features Added:

### ✓ Permanent API Token System
- **Never-expiring tokens** for automation tools
- **Token management UI** with generate, view, delete functions
- **Usage tracking** with creation and last-used timestamps
- **Secure token generation** with `sk-` prefix standard

### ✓ Enhanced Authentication
- **Dual authentication system** (temporary + permanent tokens)
- **Bearer token standard** following industry best practices
- **Improved security** by removing exposed API keys from frontend

### ✓ PostgreSQL Database
- **Permanent storage** - data survives server restarts
- **Automatic expiration handling** - expired codes marked automatically
- **Production ready** - proper database indexes and relationships

### ✓ CSV Download & Import
- **Download**: Export all codes with filtering
- **Import**: Upload and restore codes from CSV
- **Data Migration**: Perfect for platform migrations and backups

### ✓ Bulk Operations
- **Bulk selection** with checkboxes
- **Bulk delete** with confirmation dialogs
- **Bulk import** from CSV files

---

## 📞 Support

If you encounter issues:
1. **Check token format**: Ensure you're using `Authorization: Bearer <token>`
2. **Verify token validity**: Check if permanent tokens exist in the UI
3. **Monitor expiration**: Temporary tokens expire after 24 hours
4. **Check browser console**: Look for specific error messages
5. **Test with cURL**: Verify API connectivity outside your application