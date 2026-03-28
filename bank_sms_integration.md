# Bank SMS Integration Guide (React Native)

> Copy-paste these files/snippets into your target app to fetch **only bank payment SMS**.

---

## Step 1 — Native Kotlin Files

### `SmsModule.kt`
Place at: `android/app/src/main/java/com/<yourpackage>/SmsModule.kt`
> Change `package com.yourapp` to match your app's package name.

```kotlin
package com.yourapp  // ← change this to your package

import android.provider.Telephony
import com.facebook.react.bridge.*

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsModule"

    // Keywords that identify a bank/payment SMS
    private val bankKeywords = listOf(
        "debited", "credited", "debit", "credit",
        "rs.", "rs ", "inr", "₹",
        "transaction", "txn", "upi", "imps", "neft", "rtgs",
        "a/c", "account", "ac no", "bank",
        "atm", "withdrawn", "transferred", "payment",
        "avl bal", "avail bal", "balance"
    )

    // Common Indian bank sender IDs (the "address" field)
    private val bankSenders = listOf(
        "sbi", "hdfc", "icici", "axis", "kotak", "pnb", "boi", "bob",
        "canara", "union", "idbi", "yes", "indusind", "federal", "rbl",
        "paytm", "phonepe", "gpay", "amazon", "juspay", "razorpay",
        "alerts", "inform", "notify", "bank"
    )

    private fun isBankSms(address: String, body: String): Boolean {
        val addrLower = address.lowercase()
        val bodyLower = body.lowercase()
        val senderMatch = bankSenders.any { addrLower.contains(it) }
        val bodyMatch = bankKeywords.any { bodyLower.contains(it) }
        return senderMatch || bodyMatch
    }

    @ReactMethod
    fun getBankSms(limit: Int, promise: Promise) {
        try {
            val cursor = reactApplicationContext.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                null, null,
                Telephony.Sms.DEFAULT_SORT_ORDER // newest first
            )

            val smsList = Arguments.createArray()
            var added = 0

            cursor?.use {
                if (it.moveToFirst()) {
                    do {
                        val address = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: ""
                        val body    = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY))    ?: ""
                        val date    = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE))

                        if (isBankSms(address, body)) {
                            val sms = Arguments.createMap()
                            sms.putString("address", address)
                            sms.putString("body", body)
                            sms.putDouble("date", date.toDouble())
                            smsList.pushMap(sms)
                            added++
                        }
                    } while (it.moveToNext() && added < limit)
                }
            }
            promise.resolve(smsList)
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message)
        }
    }
}
```

---

### `SmsPackage.kt`
Place at: `android/app/src/main/java/com/<yourpackage>/SmsPackage.kt`

```kotlin
package com.yourapp  // ← change this to your package

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SmsModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

---

## Step 2 — Register in `MainApplication.kt`

Add `SmsPackage()` to your packages list:

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(SmsPackage())   // ← ADD THIS LINE
    }
```

---

## Step 3 — AndroidManifest Permission

Inside the `<manifest>` tag in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_SMS" />
```

---

## Step 4 — JS/TS Hook

Create `src/hooks/useBankSms.ts`:

```typescript
import { useEffect, useState } from 'react';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { SmsModule } = NativeModules;

export interface BankSms {
  address: string;  // sender (e.g. "HDFCBK", "SBIINB")
  body: string;     // message text
  date: number;     // Unix timestamp (ms)
}

export function useBankSms(limit = 50) {
  const [messages, setMessages] = useState<BankSms[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchBankSms = async () => {
    if (Platform.OS !== 'android') {
      setError('Only Android supported');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'Needed to read bank messages.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setError('SMS permission denied');
        return;
      }

      const sms: BankSms[] = await SmsModule.getBankSms(limit);
      setMessages(sms);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch SMS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBankSms(); }, []);

  return { messages, loading, error, refetch: fetchBankSms };
}
```

---

## Step 5 — Usage in any screen

```tsx
import { useBankSms } from './src/hooks/useBankSms';

export default function MyScreen() {
  const { messages, loading, error, refetch } = useBankSms(100);

  if (loading) return <ActivityIndicator />;
  if (error)   return <Text>{error}</Text>;

  return (
    <FlatList
      data={messages}
      keyExtractor={(item, i) => `${item.date}-${i}`}
      renderItem={({ item }) => (
        <View>
          <Text>{item.address}</Text>
          <Text>{item.body}</Text>
          <Text>{new Date(item.date).toLocaleString()}</Text>
        </View>
      )}
    />
  );
}
```

---

## Files Checklist

| File | Action |
|---|---|
| `SmsModule.kt` | **Create** — native reader with bank filter |
| `SmsPackage.kt` | **Create** — registers the module |
| `MainApplication.kt` | **Edit** — add `SmsPackage()` |
| `AndroidManifest.xml` | **Edit** — add `READ_SMS` permission |
| `src/hooks/useBankSms.ts` | **Create** — JS hook |

---

## How the filtering works

The `isBankSms()` function checks two things:

1. **Sender ID** — Does the SMS sender contain known bank names (`hdfc`, `sbi`, `icici`, `paytm`, etc.)?
2. **Body keywords** — Does the message contain payment words like `debited`, `credited`, `rs.`, `upi`, `txn`, `balance`, etc.?

If **either** matches, the SMS is included. You can tune both lists in `SmsModule.kt` to add/remove banks or keywords.
