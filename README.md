# Aura: Autonomous Supply Agent 🏭🤖

Aura is a state-of-the-art **Agentic Supply Chain Orchestration** engine built for the Prava Hackathon. It transforms static warehouse management systems into self-healing, self-negotiating ecosystems.

When inventory runs low, Aura automatically triggers an autonomous multi-agent workflow to discover suppliers, verify trust, negotiate pricing, and execute secure B2B payments.

## 🌟 Key Features

* **🌐 Senso Knowledge Discovery:** Dynamically scans internal and external knowledge bases (reputation forums, past transaction logs) to synthesize a "Trust Score" before engaging a supplier, preventing fraud and ensuring reliability.
* **🧠 LLM B2B Negotiation:** An autonomous AI buyer engages the supplier to negotiate bulk discounts and favorable terms based on historical context, completely removing humans from the back-and-forth email chain.
* **🔐 Prava Smart Escrow:** Zero-trust financial safety. Funds are programmatically locked in a Prava Escrow session and only released upon successful delivery of the inventory.
* **📱 Linq SMS Approvals:** Human-in-the-loop made easy. Warehouse managers receive a highly actionable SMS via the Linq API containing a 1-click Prava approval link.
* **📦 Aura SDK (`@aura-hq/sdk`):** A fully decoupled, event-driven Node.js SDK that any 3rd-party company can integrate into their existing backend with just two lines of code.

## 🚀 Live Demo Architecture

The project contains a cohesive three-part architecture:
1. **The Aura Landing Page:** A premium, dark-mode marketing site that explains the value proposition.
2. **The Aura Command Center:** A glassmorphic, real-time dashboard powered by Server-Sent Events (SSE) that visualizes the autonomous agents at work.
3. **The Acme Corp Client:** A standalone sample application (`examples/sample-client`) demonstrating how an external company implements the Aura SDK.

## 🛠 Setup & Installation

### Prerequisites
* Node.js (v18+)
* API Keys for Prava, Linq, and Senso

### 1. Install Dependencies
```bash
# Install backend dependencies
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
PRAVA_API_KEY=your_prava_key
LINQ_TOKEN=your_linq_token
LINQ_FROM_NUMBER=+1234567890
LINQ_TO_NUMBER=+1987654321
```

### 3. Run the Platform
```bash
# Starts the Aura Dashboard and API
npm start
```
The Command Center will be available at `http://localhost:3001`

### 4. Run the Sample Client (Acme Corp)
In a separate terminal, start the sample client to test the SDK integration:
```bash
cd examples/sample-client
npm install
node index.js
```
The Client Site will be available at `http://localhost:4000`

## 🏗 How It Works (The Lifecycle)

1. **Trigger:** Acme Corp's inventory falls below the threshold. The client calls `aura.handleRestock(item)`.
2. **Discovery:** Aura queries the **Senso KB** for trusted merchants.
3. **Evaluation:** An LLM extracts reputation data and ranks the best supplier.
4. **Negotiation:** The AI Buyer haggles for a bulk discount.
5. **Escrow:** A **Prava** payment session is generated for the finalized amount.
6. **Notification:** A **Linq** SMS is sent to the manager to approve the Prava iframe.
7. **Completion:** An invoice PDF is generated and sent, and the internal database is replenished.

---
*Built with ❤️ for the Prava Hackathon.*
