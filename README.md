# Intent Execution Engine 🚀

**Transform natural language into database queries with AI-powered precision**

## 🎯 What It Does

Convert everyday language like:
> *"Show me high-value customers in California who haven't purchased in 90 days"*

Into accurate database queries and results - automatically.

## ✨ Key Features

- **🧠 Smart Table Selection** - AI picks only relevant database tables
- **⚡ Blazing Fast** - Reduces 35+ tables to focused subsets for optimal performance  
- **🔄 Self-Correcting** - Automatically fixes query errors with intelligent retry
- **💬 Conversational** - Handles both complex queries and simple chat
- **🛡️ Safe & Reliable** - Built-in validation and error handling

## 🚀 Quick Start

### 1. Installation
```bash
npm install
npm run build
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
```

### 3. Run Demo
```bash
npm run dev
```

Try these queries:
- `"How many customers are in New York?"`
- `"Show me opportunities worth over $10,000"`
- `"What support tickets are overdue?"`

## 🏗️ Architecture Overview

```
Natural Language → AI Table Selector → Intent Engine → Database → Results
                    ↓
              Reduces 35+ tables to relevant subset
```

### Core Components

- **Table Selector** - Haiku AI chooses relevant tables
- **Intent Engine** - Converts language to executable graphs  
- **Schema System** - Comprehensive CRM database model
- **Query Runtime** - Safe SQL execution with validation

## 📊 Supported Database

**Comprehensive CRM Schema** with 35+ tables:
- **Customers & Contacts** - Accounts, people, leads
- **Sales** - Opportunities, pipelines, products, quotes
- **Support** - Tickets, activities, communications
- **Operations** - Users, teams, tasks, audit logs

## 💡 Usage Examples

### Simple Queries
```typescript
// Customer analytics
"How many active customers do we have?"

// Sales insights  
"Show me opportunities closing this month"

// Support metrics
"What's our average ticket resolution time?"
```

### Complex Queries
```typescript
// Multi-table analysis
"Find enterprise accounts with overdue support tickets and high-value opportunities"

// Time-based filtering
"Show me leads converted in the last quarter who are now customers"

// Geographic analysis
"Which cities have the most high-value opportunities assigned to sales reps?"
```

## 🛠️ Development

### Running Tests
```bash
npm test                    # All tests
npm run test:tableSelector  # Table selector tests
npm run test:intent         # Intent engine tests
```

### Project Structure
```
src/
├── tableSelector/     # AI table selection
├── intent/           # Core intent processing
├── graph/            # Query execution graphs
├── config/           # Schema & configuration
└── api/              # HTTP API layer
```

## ⚙️ Configuration

Key settings in `src/config/default.json`:

```json
{
  "llm": {
    "model": "claude-opus-4-6",
    "tableSelectorModel": "claude-haiku-4-5-20251001"
  },
  "app": {
    "maxQueryLimit": 20,
    "debug": true
  }
}
```

## 🔧 Advanced Features

### Table Selection
The AI automatically reduces schema complexity:
- **35+ tables** → **3-6 relevant tables**
- Preserves foreign key relationships
- Adds bridge tables for joins
- Falls back safely if AI fails

### Self-Correction
- Detects and fixes SQL errors automatically
- Retries with improved prompts
- Maintains conversation context
- Provides detailed error feedback

### Conversational Mode
Handles both database queries and natural conversation:
- `"Hi"` → `"Hello! How can I help you today?"`
- `"What's the weather?"` → Appropriate response
- `"Show me customers"` → Database query

## 📈 Performance

- **Query Generation**: ~2-5 seconds
- **Table Selection**: ~500ms
- **Self-Correction**: 1-2 retries average
- **Schema Reduction**: 90% smaller on average

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 More Information

- **Technical Documentation**: See `docs/TECHNICAL.md`
- **API Reference**: See `docs/API.md`  
- **Schema Definition**: See `src/config/schema.json`

---

**Built with ❤️ using Anthropic Claude**
