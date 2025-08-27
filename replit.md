# Overview

Mind Reader is a cognitive/psychological/psychopathological profiler application that provides six distinct analysis modes: Cognitive (Short/Long), Psychological (Short/Long), and Psychopathological (Short/Long). The application functions as a pure passthrough system with no filtering or hardcoded logic, relaying user input directly to LLM services and returning unfiltered responses. Key features include user-selectable text chunking for documents over 300 words (testing threshold, normally 1000), simplified ZHI provider naming system (ZHI 1, ZHI 2, etc.), and download functionality for evaluations as TXT files.

# User Preferences

Preferred communication style: Simple, everyday language.

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
- **File Processing**: Multer for file uploads with support for PDF, Word, and text files
- **Analysis Engine**: Custom service that processes questions in batches of 5 to avoid token limits
- **Storage**: Configurable storage interface with in-memory implementation for development

## Core Services
- **LLM Service**: Abstraction layer supporting multiple AI providers with simplified ZHI naming system:
  - ZHI 1: Primary analysis engine using OpenAI GPT models
  - ZHI 2: Claude-based reasoning using Anthropic's claude-sonnet-4-20250514
  - ZHI 3: Specialized analysis capabilities using DeepSeek
  - ZHI 4: Research-focused analysis using Perplexity
- **File Processor**: Handles text extraction from uploaded documents (PDF, Word, TXT files)
- **Analysis Engine**: Pure passthrough system with no filtering, manages question sets for six analysis modes
- **Chunk Selection**: User-controlled chunking interface for documents over 1000 words

## Data Flow Design
- **Input Processing**: Supports text input, file uploads (PDF/DOC/TXT), and paste functionality
- **Chunk Selection**: Automatic chunking for 1000+ word texts with user-selectable chunks for analysis
- **Pure Passthrough**: No filtering, calibration, or hardcoded logic - direct LLM evaluation
- **Analysis Modes**: Six distinct modes with Short (Phase 1 only) and Long (4-phase) variants
- **Real-time Streaming**: Responses displayed immediately as they arrive via Server-Sent Events
- **Download Capability**: Results downloadable as TXT files with complete analysis data

## Security and Validation
- **File Upload Restrictions**: 10MB limit with MIME type and extension validation for PDF, DOC, DOCX, TXT
- **Input Validation**: Zod schemas for all data structures and analysis configurations
- **Error Handling**: Comprehensive error boundaries and user feedback mechanisms
- **Pure Passthrough Design**: No data manipulation, filtering, or hardcoded scoring adjustments

# External Dependencies

## AI/LLM Services
- **ZHI 1**: OpenAI API for primary analysis engine
- **ZHI 2**: Anthropic Claude using claude-sonnet-4-20250514 for reasoning
- **ZHI 3**: DeepSeek for specialized profiling
- **ZHI 4**: Perplexity for research-focused analysis

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