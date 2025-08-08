# Overview

This is a promo code management system built with React, Express, TypeScript, and PostgreSQL. The application allows users to generate, view, and redeem promotional codes with different formatting options. It features a modern web interface built with shadcn/ui components and Tailwind CSS, backed by a REST API server and PostgreSQL database managed through Drizzle ORM.

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
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **API Design**: RESTful API with JSON responses
- **Error Handling**: Centralized error middleware with structured error responses
- **Logging**: Custom request/response logging for API endpoints
- **Build Process**: esbuild for production bundling

## Database Architecture
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Connection**: Neon serverless PostgreSQL driver (@neondatabase/serverless)
- **Schema Management**: Type-safe schema definitions with Zod validation
- **Tables**: 
  - Users table with UUID primary keys
  - Promo codes table with status tracking and timestamps

## Development Setup
- **Development Server**: Vite dev server with HMR for frontend, tsx for backend hot reloading
- **Build Process**: Vite for frontend static assets, esbuild for backend bundling
- **TypeScript**: Shared types between frontend and backend via shared directory
- **Path Aliases**: Configured for clean imports (@/ for client, @shared/ for shared code)

## Key Features
- **Promo Code Generation**: Single and bulk generation with customizable formats
- **Code Management**: View all codes with search and filtering capabilities
- **Statistics Dashboard**: Real-time stats on total, used, and available codes
- **Code Redemption**: Mark codes as used with timestamp tracking
- **Responsive Design**: Mobile-first design with shadcn/ui components

## External Dependencies

- **Database**: Neon PostgreSQL (serverless)
- **UI Components**: Radix UI primitives for accessible components
- **Icons**: Lucide React for consistent iconography
- **Development Tools**: Replit-specific plugins for development environment integration
- **Fonts**: Google Fonts (Inter) for typography
- **Build Tools**: Vite, esbuild, PostCSS, Autoprefixer for asset processing