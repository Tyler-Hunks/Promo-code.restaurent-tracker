# Promo Code API Documentation

## Overview
Your promo code management system uses **Bearer token authentication** for security and supports **unlimited scale** with optimized performance for 10,000+ codes. The system supports both temporary session tokens and permanent API tokens for different use cases, with comprehensive **campaign-based analytics** and **CSV import/export** capabilities.

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

## 🎯 Campaign Management Endpoints

### Get All Campaigns
**GET** `/api/campaigns`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

**Response:**
```json
[
  "Summer Sale",
  "Holiday Special",
  "Performance Test"
]
```

### Get Campaign Statistics
**GET** `/api/campaigns/stats`

**Headers:**
```json
{
  "Authorization": "Bearer <your-token>"
}
```

**Response:**
```json
[
  {
    "campaignName": "Summer Sale",
    "available": 1500,
    "used": 250
  },
  {
    "campaignName": "Holiday Special", 
    "available": 800,
    "used": 100
  }
]
```

**Features:**
- Real-time campaign analytics
- Available vs used code tracking per campaign
- Automatic filtering of expired codes
- Optimized for large datasets (10,000+ codes per campaign)

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
- `export=all` - Download all codes as CSV (ignores pagination)

**Performance Note:** Optimized for large datasets with no practical limit on total codes stored.

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
  "total": 10011,
  "used": 250,
  "available": 9700,
  "expired": 61
}
```

**Note:** Statistics are calculated in real-time across all codes with automatic expired code detection.

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

# Get campaign statistics
curl -X GET https://your-domain.com/api/campaigns/stats \
  -H "Authorization: Bearer sk-your-permanent-token-here"

# Export all codes as CSV
curl -X GET "https://your-domain.com/api/promo-codes?export=all" \
  -H "Authorization: Bearer sk-your-permanent-token-here" \
  -o promo-codes-export.csv
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
- **NEW**: Tokens now use stateless cryptographic signing and persist across server restarts

**"Token not found"**
- The permanent token may have been deleted from the UI
- Generate a new permanent token if needed

**Performance with Large Datasets**
- **SOLVED**: Removed previous 1000-code pagination limits
- System now optimized for 10,000+ codes with real-time statistics
- Use `export=all` parameter for complete CSV downloads without pagination

**Campaign Statistics Loading Slowly**
- **OPTIMIZED**: Campaign stats now use SQL functions for faster calculation
- Real-time campaign analytics work efficiently with large datasets
- Statistics are cached and updated automatically

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

## 🆕 Latest Features & Improvements:

### ✓ **Campaign-Based Analytics** (NEW!)
- **Real-time campaign statistics** showing available vs used codes per campaign
- **Campaign overview** with comprehensive performance metrics
- **Automatic campaign grouping** for better organization
- **Quick Stats dashboard** with campaign breakdown

### ✓ **Unlimited Scale Performance** (ENHANCED!)
- **Removed 1000-code pagination limit** - now supports 10,000+ codes seamlessly
- **Optimized database queries** for large dataset performance
- **Real-time statistics** calculated efficiently across all codes
- **Production-grade scalability** tested with 10,000+ codes

### ✓ **Advanced Authentication System**
- **Stateless Bearer tokens** that persist across server restarts
- **Cryptographic token signing** using secure HMAC-SHA256
- **Dual token system**: Temporary (24h) + Permanent (never expire)
- **Environment variable security** - no hardcoded keys in source code

### ✓ **Supabase Database Integration**
- **Production PostgreSQL** with Supabase cloud infrastructure
- **Automatic connection pooling** for high-performance operations
- **Persistent data storage** with automatic backups
- **SQL-based campaign statistics** with optimized functions

### ✓ **Enhanced CSV Operations**
- **Full export capability** - download all codes regardless of pagination
- **Smart import system** with duplicate detection and skip handling
- **Campaign-aware import/export** preserving all metadata
- **Data migration tools** for platform transitions

### ✓ **Production Deployment Ready**
- **Cloudflare Workers deployment** with global edge distribution
- **Environment variable management** through secure secrets
- **Zero-downtime authentication** with stateless token design
- **CORS-enabled API** for cross-origin web applications

---

## 📞 Support

If you encounter issues:
1. **Check token format**: Ensure you're using `Authorization: Bearer <token>`
2. **Verify token validity**: Check if permanent tokens exist in the UI
3. **Monitor expiration**: Temporary tokens expire after 24 hours
4. **Check browser console**: Look for specific error messages
5. **Test with cURL**: Verify API connectivity outside your application