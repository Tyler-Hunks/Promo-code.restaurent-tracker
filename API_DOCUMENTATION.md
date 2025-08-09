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
- Currently using **in-memory storage**
- Data will be lost when server restarts
- For production, consider migrating to PostgreSQL

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

### ✓ CSV Download
- Click the **"CSV (X)"** button to download all filtered codes
- File includes: Code, Status, Campaign, Discount Value, Created At, Used At, Expires At
- File name: `promo-codes-YYYY-MM-DD.csv`

### ✓ Bulk Delete
- Select multiple codes with checkboxes
- Delete selected codes with confirmation dialog
- Clear selection option available

### ✓ Enhanced Security
- API key authentication on all endpoints
- Environment variable configuration
- Production-ready security measures

---

## Support

If you encounter issues:
1. Check that your API key is correctly set in environment variables
2. Verify the `x-api-key` header is included in all requests
3. Ensure both `API_KEY` and `VITE_API_KEY` have the same value
4. Check browser network tab for specific error messages