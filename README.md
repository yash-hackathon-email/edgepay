# 📱 EdgePay: The Offline Financial Engine

> **EdgePay** is an offline-first financial inclusion platform that enables digital banking and UPI-style payments in locations with zero internet connectivity. By harnessing the **GSM/USSD (Unstructured Supplementary Service Data)** protocol and NPCI's **NUUP (National Unified USSD Platform)**, EdgePay brings the convenience of digital finance to the 2G/GSM network.

---

## 🌟 Key Features

### 1. 📡 Internet-Free Payments
- No WiFi, 3G, 4G, or 5G required.
- Works strictly over the **GSM/2G signal**.
- Leverages the **NPCI *99# (NUUP)** infrastructure for bank-to-bank transfers.

### 2. 🏦 Adaptive Bank Logic
- **SBI Integration**: Uses a custom **SMS-based balance fetch** system. Sends `BAL` request to `09223766666` and parses the incoming `SBIPSG` response for real-time accuracy.
- **HDFC & Others**: Utilizes the standard **USSD Gateway (*99*3#)** for balance enquiries.
- Hand-tuned **Regex Parser** for various Indian bank SMS formats.

### 3. 🔐 Secure Interaction Design
- **Masked Dashboard**: Balances are hidden by default (`₹ ******`) for user privacy.
- **PIN Verification**: Every sensitive action (Check Balance, Send Money) is protected by a PIN challenge modal.
- **OWASP Compliance**: PIN memory handling follows secure coding practices (zeroed after usage).

### 4. 📷 Offline QR Scanning
- Integrated **Vision Camera** frame processor for rapid QR decoding.
- Extracts UPI VPA and Amount directly from the QR code and populates the offline USSD string builder.

---

## 🛠 Technical Architecture

EdgePay is built with a decoupled architecture where the UI layer communicates with a specialized "Banking Engine."

### The Engine Stack (`/src/engine`)
- **`USSDBuilder.ts`**: The core protocol builder that constructs the encoded strings for NUUP sessions.
- **`SmsParser.ts`**: The "regex brain" that identifies successful transaction alerts and extracts amounts/reference numbers from bank SMS.
- **`SmsService.ts / USSDService.ts`**: The bridge between React Native and the **Kotlin NativeModules**.

### The Mobile Stack
- **Frontend**: React Native, TypeScript.
- **State Management**: Zustand (for lightning-fast, offline-optimized state sync).
- **Navigation**: React Navigation (Stack) with custom header transitions.
- **Styling**: Vanilla CSS/StyleSheet for maximum performance on low-end hardware.

---

## 🏗 Directory Structure

```text
EdgePay/
├── android/               # Native Kotlin USSD & SMS bridges
├── src/
│   ├── engine/            # The Protocol Engine (SMS/USSD parsing)
│   ├── screens/           # React Native Screens (Dashboard, PIN, QR)
│   ├── components/        # Reusable UI Elements (Modals, Custom Inputs)
│   ├── store/             # Zustand Store (Offline state persistence)
│   ├── theme/             # Design Tokens & Colour Palettes
│   └── utils/             # Formatters, i18n, Constants
├── index.html             # High-Fidelity Engine Life-Simulation
└── README.md              # Technical Specification
```

---

## 📦 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Android SDK** (API 29+)
- **Physical Android Device**: USSD/SMS listeners cannot be emulated; a real SIM card is required for full functionality.

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yash-hackathon-email/edgepay.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Compile and Install**:
   ```bash
   npx react-native run-android --variant=release
   ```

---

## 📜 How it Works (The Workflow)

1. **Onboarding**: User selects their bank (SBI/HDFC).
2. **Dashboard**: The app checks the Local Store for the last known balance (masked).
3. **Check Balance**:
   - If **SBI**, EdgePay triggers an SMS to `09223766666`.
   - The **SmsListener** waits for a response from `AD-SBIPSG-S`.
   - Once received, the **SmsParser** extracts the numeric balance and updates the UI.
4. **Send Money**:
   - The user inputs a UPI ID or scans a QR.
   - The **USSDBuilder** creates an NUUP-compliant dial string.
   - The **UssdModule** dispatches a system-level call to initiate the transaction.

---

## 🏆 Project Recognition
Developed by **Nishant Kumar** for the **Advanced Agentic Coding Hackathon**.

---

## ⚖️ Disclaimer
EdgePay is a technical demonstration of USSD/SMS banking protocols. Always ensure you are on a trusted mobile network when using NUUP service (*99#).
