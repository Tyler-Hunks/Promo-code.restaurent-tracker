# Overview

This is a promo code management system built with React, Express, TypeScript, and PostgreSQL. The application allows users to generate, view, and redeem promotional codes with different formatting options. It features a modern web interface built with shadcn/ui components and Tailwind CSS, backed by a REST API server and PostgreSQL database managed through Drizzle ORM.

**Current Status**: Production-ready system deployed on Cloudflare Workers with Supabase PostgreSQL database, optimized for large datasets (10,000+ codes) with pagination, comprehensive download capabilities, and performance optimization features.

## Quick Setup Instructions

1. **Login API Key**: Use this API key to log in: `mwlijmhevsgorhwoysmaldxiyadetmqilduoxlni`
2. **Development**: Run `npm run dev` to start the development server on port 5000
3. **Production**: Deploy to Cloudflare Workers with Supabase database connection
4. **Features**: Campaign-based analytics, bulk operations, CSV import/export, Bearer token authentication

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Framework**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Cloudflare Workers
- **Runtime**: Cloudflare Workers with Node.js compatibility
- **API Design**: RESTful API with JSON responses
- **Error Handling**: Centralized error middleware with structured error responses
- **Logging**: Custom request/response logging for API endpoints
- **Build Process**: esbuild for production bundling
- **Deployment**: Cloudflare Workers with GitHub integration for CI/CD

## Database Architecture
- **Database**: PostgreSQL (Supabase) - ACTIVE PRODUCTION STORAGE
- **ORM**: Drizzle ORM with drizzle-kit for schema management
- **Connection**: Supabase PostgreSQL with postgres driver
- **Schema Management**: Type-safe schema definitions with Zod validation
- **Storage Implementation**: DatabaseStorage class with optimized queries
- **Tables**: 
  - Users table with UUID primary keys
  - Promo codes table with status tracking, automatic expiration, and full campaign support
- **Features**: Automatic expired code detection, bulk operations, CSV import/export, pagination for large datasets
- **Performance**: Optimized for 10,000+ codes with indexed queries and pagination

## Development Setup
- **Development Server**: Vite dev server with HMR for frontend, tsx for backend hot reloading
- **Build Process**: Vite for frontend static assets, esbuild for backend bundling
- **TypeScript**: Shared types between frontend and backend via shared directory
- **Path Aliases**: Configured for clean imports (@/ for client, @shared/ for shared code)

## Key Features
- **Promo Code Generation**: Single and bulk generation with customizable formats (PROMO-XXXX to XXXXXXXXXX)
- **Code Management**: View all codes with search and filtering capabilities
- **Statistics Dashboard**: Real-time stats on total, used, available, and expired codes
- **Code Redemption**: Mark codes as used with timestamp tracking
- **CSV Operations**: Full export and import functionality for data migration
- **Bulk Operations**: Multi-select deletion with confirmation dialogs
- **Database Persistence**: PostgreSQL storage with automatic expiration handling
- **API Authentication**: Secure API key protection on all endpoints
- **Responsive Design**: Mobile-first design with shadcn/ui components

## Security Architecture
- **Authentication**: Bearer token system for secure API access
- **Login Flow**: Users authenticate with API key to receive secure tokens
- **Token Storage**: Tokens stored in browser localStorage with automatic cleanup
- **API Protection**: All endpoints require valid Bearer tokens except login
- **Headers**: Authorization: Bearer <token> for all authenticated requests
- **Development**: Same authentication system for both dev server and production Worker

## External Dependencies

- **Database**: Neon PostgreSQL (serverless) 
- **UI Components**: Radix UI primitives for accessible components
- **Icons**: Lucide React for consistent iconography
- **Development Tools**: Replit-specific plugins for development environment integration
- **Fonts**: Google Fonts (Inter) for typography
- **Build Tools**: Vite, esbuild, PostCSS, Autoprefixer for asset processing