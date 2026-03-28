# ⚡ EdgePay

**“EdgePay is a hybrid payment interface that enables transactions in low or no internet environments by leveraging GSM infrastructure and translating modern payment interactions like QR scanning into SMS-based execution.”**

---

## 🚀 Overview

EdgePay solves the "no internet at checkout" problem. It's a hybrid mobile application that detects your connection status and switches to **GSM Mode** when offline. In this mode, modern payment actions (like scanning a UPI QR code) are translated into secure SMS commands sent to bank gateways, bringing 24/7 transaction reliability to areas with poor data coverage.

## ✨ Key Features

-   📡 **GSM Fallback**: Automatically switches to SMS-based execution when internet is unavailable.
-   📷 **QR-to-SMS Translation**: Scans UPI QR codes and extracts payment data into SMS-compliant formats.
-   🔄 **Transaction Queue**: Local-first architecture with a retry system for pending transactions.
-   🏦 **SMS Parser**: Intelligent bank response detection to update transaction status (Success/Failed).
-   🎨 **Premium UI**: Dark-mode, motion-driven experience following high-end SaaS standards (Notion/Stripe style).
-   🔒 **Privacy First**: No storage of PINs, OTPs, or bank credentials.

## 🛠️ Stack

-   **Frontend**: React Native CLI (JavaScript/TypeScript)
-   **Native Layer**: Kotlin (SMS Manager + BroadcastReceiver)
-   **State**: Zustand (with AsyncStorage persistence)
-   **Navigation**: React Navigation v7
-   **Components**: Custom Vanilla CSS/StyleSheet (Mobile-first, responsive)
-   **Optional Backend**: Node.js + Express (Sync & Analytics)

## 📁 Project Structure

```text
EdgePay/
├── android/                 # Native Android bridge (Kotlin)
├── src/
│   ├── engine/              # Core JS logic (SMS, Network, Queue)
│   ├── screens/             # Premium UI Pages
│   ├── components/          # Reusable UI Atoms
│   ├── store/               # Zustand Global State
│   └── utils/               # Formatters & QR Parser
└── backend/                 # Optional Sync Server
```

## 🏁 Getting Started

### Prerequisites
-   Node.js v20+
-   Android Studio & SDK
-   Physical Device (Required for native SMS features)

### Installation
1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run Android App**:
    ```bash
    npx react-native run-android
    ```

3.  **Run Optional Backend**:
    ```bash
    cd backend
    npm install
    npm start
    ```

## ⚠️ Limitations
-   **Carrier Latency**: SMS delivery depends on GSM network congestion.
-   **Format Dependency**: SMS Parser is optimized for common Indian bank formats.
-   **Demo Mode**: The current build includes a simulation toggle in `TransactionEngine.ts` for testing without costing real SMS credits.

---
*Built as a proof-of-concept for high-reliability financial interfaces.*
