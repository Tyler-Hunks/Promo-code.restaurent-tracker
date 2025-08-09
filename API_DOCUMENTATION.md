# Promo Code API Documentation

## Overview
Your promo code management system now uses **API key authentication** for security. All API requests must include the `x-api-key` header.

## Authentication
- **Header Required**: `x-api-key: your-secure-api-key-here`
- **Environment Variables**: 
  - Backend: `API_KEY`
  - Frontend: `VITE_API_KEY`

---

## API Endpoints

### 1. Generate Single Promo Code
**POST** `/api/promo-codes/generate`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "your-secure-api-key-here"
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
  "createdAt": "2025-01-09T13:47:00Z",
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
  "x-api-key": "your-secure-api-key-here"
}
```

**Request Body:**
```json
{
  "count": 10,
  "format": "SAVE-XXXX-XX"
}
```

### 3. Generate Campaign Codes
**POST** `/api/promo-codes/generate-campaign`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "your-secure-api-key-here"
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
  "x-api-key": "your-secure-api-key-here"
}
```

### 5. Redeem Promo Code
**POST** `/api/promo-codes/redeem`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "your-secure-api-key-here"
}
```

**Request Body:**
```json
{
  "code": "PROMO-A1B2"
}
```

### 6. Delete Single Code
**DELETE** `/api/promo-codes/{code}`

**Headers:**
```json
{
  "x-api-key": "your-secure-api-key-here"
}
```

### 7. Delete Multiple Codes
**DELETE** `/api/promo-codes`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "your-secure-api-key-here"
}
```

**Request Body:**
```json
{
  "codes": ["PROMO-A1B2", "PROMO-C3D4", "PROMO-E5F6"]
}
```

### 8. Import Promo Codes from CSV
**POST** `/api/promo-codes/import`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "your-secure-api-key-here"
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

## Code Generation Formats

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

## Deployment Requirements

### For Any Hosting Platform (Google Cloud, AWS, etc.):

#### 1. **Environment Variables (CRITICAL)**
Set these environment variables on your hosting platform:
```bash
# Backend API Key
API_KEY=your-super-secure-random-api-key-here

# Frontend API Key (must be prefixed with VITE_)
VITE_API_KEY=your-super-secure-random-api-key-here
```

#### 2. **Port Configuration**
- Your app runs on **port 5000** by default
- Make sure your hosting platform exposes this port
- Some platforms might require `PORT=5000` environment variable

#### 3. **Build Commands**
Your hosting platform should run:
```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start the production server
npm start
```

#### 4. **Static Files**
- Frontend builds to `dist/` directory
- Backend serves static files automatically
- No separate static hosting needed

#### 5. **Database**
- Now using **PostgreSQL** for permanent storage
- Data persists across server restarts and deployments
- Tables: `users` and `promo_codes` with proper relationships and indexes

### Security Considerations:
1. **Generate strong API keys** (32+ random characters)
2. **Use HTTPS** in production
3. **Set secure CORS policies** if needed
4. **Consider rate limiting** for high-traffic scenarios

---

## Testing Your HTTP Requests

### Using cURL:
```bash
# Generate a single code
curl -X POST http://your-domain.com/api/promo-codes/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secure-api-key-here" \
  -d '{
    "format": "TEST-XXXX",
    "campaignName": "Test Campaign",
    "discountValue": "10% off"
  }'
```

### Using JavaScript fetch:
```javascript
const response = await fetch('/api/promo-codes/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-secure-api-key-here'
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

---

## New Features Added:

### ✓ PostgreSQL Database
- **Permanent storage** - data survives server restarts
- **Automatic expiration handling** - expired codes marked automatically
- **Production ready** - proper database indexes and relationships

### ✓ CSV Download & Import
- **Download**: Click the **"CSV (X)"** button to download all filtered codes
- **Import**: Click **"Import CSV"** button to upload and restore codes
- **Data Migration**: Perfect for moving between platforms or backup/restore
- File format: `Code,Status,Campaign,Discount Value,Created At,Used At,Expires At`

### ✓ Enhanced Code Generation
- **Flexible formats**: From `PROMO-XXXX` (1.6M codes) to `XXXXXXXXXX` (3.6Q codes)
- **Custom prefixes**: `REST2024-XXXX`, `HOLIDAY-XXXXXX`, etc.
- **Collision detection**: Automatic uniqueness validation

### ✓ Bulk Operations
- **Bulk selection** with checkboxes
- **Bulk delete** with confirmation dialog
- **Bulk import** from CSV files

### ✓ Enhanced Security
- **API key authentication** on all endpoints
- **Environment variable** configuration
- **Production-ready** security measures

---

## Support

If you encounter issues:
1. Check that your API key is correctly set in environment variables
2. Verify the `x-api-key` header is included in all requests
3. Ensure both `API_KEY` and `VITE_API_KEY` have the same value
4. Check browser network tab for specific error messages