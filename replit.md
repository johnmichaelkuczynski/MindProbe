# Overview

Mind Reader is a cognitive/psychological/psychopathological profiler application that provides six distinct analysis types: cognitive, comprehensive cognitive, psychological, comprehensive psychological, psychopathological, and comprehensive psychopathological. The application functions as a passthrough system that relays user input to LLM services and returns unfiltered responses for professional assessment purposes.

The application includes a comprehensive payment system with optional authentication, Stripe integration, credit-based usage tracking, and partial paywall functionality.

## Recent Changes (September 30, 2025)
- ✓ **PAYMENT SYSTEM IMPLEMENTED**: Complete credit-based payment system with Stripe integration
- ✓ **AUTHENTICATION SYSTEM**: Optional user authentication with session management (no password wall)
- ✓ **STRIPE INTEGRATION**: Multi-tier credit purchasing across all 4 ZHI models (OpenAI, Anthropic, DeepSeek, Perplexity)
- ✓ **CREDIT TRACKING**: Real-time credit balance display with automatic deduction based on LLM word count
- ✓ **PARTIAL PAYWALL**: Shows half analysis results to users without credits or not logged in
- ✓ **SPECIAL USER**: JMK user (case insensitive) with unlimited credits and no password requirement for debugging
- ✓ **USERNAME NORMALIZATION**: Fixed authentication to normalize usernames to lowercase consistently

## Previous Changes (August 27, 2025)
- ✓ Updated analysis engine to send complete instruction text with every LLM request
- ✓ Implemented revised intelligence protocol with updated scoring methodology
- ✓ Added paradigm example of phony pseudo-intellectual text for LLM reference
- ✓ Fixed PDF upload functionality with proper text extraction
- ✓ Enhanced scoring calibration: scores represent outperformance (XX/100 = author outperforms XX people)
- ✓ Removed all formatting markup from LLM outputs for clean plain text responses
- ✓ **VERIFIED WORKING**: System successfully processing analyses with revised protocol (August 27, 2025)
- ✓ Real-time streaming confirmed functional with proper SSE connections
- ✓ Added "New Analysis" button for easy reset functionality
- ✓ **OUTSTANDING PERFORMANCE**: LLM properly identifying and analyzing pseudo-intellectual text with sophisticated evaluation
- ✓ Added drag and drop functionality to text input area with visual feedback
- ✓ **APPLICATION FULLY FUNCTIONAL**: User confirmed excellent performance with all features working properly

# User Preferences

Preferred communication style: Simple, everyday language.
User satisfaction: Extremely high - "EXCELLENT. THE APP WORKS WELL!"

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Server-Sent Events (SSE) for streaming analysis results

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with express-session and PostgreSQL session store
- **Payment Processing**: Stripe integration with webhook handling for credit purchases
- **File Processing**: Multer for file uploads with support for PDF, Word, and text files
- **Analysis Engine**: Custom service that processes questions in batches of 5 to avoid token limits
- **Credit System**: Word-count-based credit deduction with real-time balance updates

## Core Services
- **LLM Service**: Abstraction layer supporting multiple AI providers (OpenAI, Anthropic, DeepSeek, Perplexity) referenced as ZHI 1-4
- **File Processor**: Handles text extraction from uploaded documents using pdf-parse and mammoth libraries
- **Analysis Engine**: Manages question sets and coordinates streaming responses for real-time feedback

## Data Flow Design
- **Input Processing**: Supports both text input and file uploads with validation
- **Batch Processing**: Questions sent to LLMs in groups of 5 with 10-second delays between batches
- **Real-time Streaming**: Responses displayed immediately as they arrive via SSE
- **Dialogue System**: Post-analysis conversation capability with regeneration options based on user feedback

## Security and Validation
- **File Upload Restrictions**: 10MB limit with MIME type and extension validation
- **Input Validation**: Zod schemas for all data structures
- **Error Handling**: Comprehensive error boundaries and user feedback mechanisms
- **Session Security**: Secure session management with PostgreSQL-backed session store
- **Password Hashing**: bcryptjs for secure password storage
- **Stripe Security**: Webhook signature verification for payment processing

## Payment System Architecture

### Credit-Based Model
- **Credit Unit**: 1 credit = 1 word of LLM output
- **Usage Tracking**: Credits deducted after analysis completion based on actual word count
- **Balance Display**: Real-time credit balance shown in application header
- **Unlimited Access**: Special users (JMK) have unlimited credits with isUnlimited flag

### Pricing Tiers
Four ZHI models with tiered pricing ($5, $10, $25, $50, $100 per tier):
- **ZHI 1 (OpenAI)**: 4.3M - 115M words per purchase
- **ZHI 2 (Anthropic)**: 107K - 2.9M words per purchase
- **ZHI 3 (DeepSeek)**: 702K - 19M words per purchase
- **ZHI 4 (Perplexity)**: 6.4M - 173M words per purchase

### Authentication Flow
- **Optional Authentication**: Users can use app without login (with paywall)
- **Registration**: Username/password with automatic normalization to lowercase
- **Login**: Session-based with PostgreSQL session store
- **Special User (JMK)**: Case-insensitive username, accepts any password, unlimited credits

### Paywall Implementation
- **Trigger Conditions**: Not logged in OR user has 0/insufficient credits
- **Display Behavior**: Shows first half of analysis results (rounded up)
- **Call to Action**: "TO GET THE REST BUY CREDITS" message with purchase button
- **Bypass**: Unlimited users (JMK) see full results without paywall

### Payment Processing
- **Stripe Checkout**: Hosted checkout session for secure payment
- **Webhook Handler**: Processes checkout.session.completed events
- **Credit Fulfillment**: Automatic credit addition upon successful payment
- **Purchase Tracking**: creditPurchases table logs all transactions with status

# External Dependencies

## AI/LLM Services
- **OpenAI API**: Primary analysis engine (referenced as ZHI 1)
- **Anthropic Claude**: Alternative reasoning model (referenced as ZHI 2) using claude-sonnet-4-20250514
- **DeepSeek**: Specialized profiling engine (referenced as ZHI 3)
- **Perplexity**: Research-focused model (referenced as ZHI 4)

## Database and Storage
- **PostgreSQL**: Primary data storage via Neon Database serverless
- **Drizzle ORM**: Type-safe database operations and migrations

## File Processing Libraries
- **pdf-parse**: PDF text extraction
- **mammoth**: Microsoft Word document processing
- **multer**: File upload handling

## Development and Build Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Backend bundling for production
- **Replit**: Development environment with specific plugins for cartographer and error handling