package com.edgepay.app.widget

data class PaymentInfo(
    val type: String,       // "CREDIT" or "DEBIT"
    val amount: Double,
    val sender: String,
    val bank: String,
    val refNumber: String?
)

object SmsPaymentParser {

    private val BANK_MAP = mapOf(
        "HDFCBK" to "HDFC Bank",
        "SBIBNK" to "State Bank of India",
        "ICICIB" to "ICICI Bank",
        "PNBSMS" to "Punjab National Bank",
        "BOIIND" to "Bank of India",
        "CANBNK" to "Canara Bank",
        "UNIONB" to "Union Bank",
        "AXISBK" to "Axis Bank",
        "KOTAKB" to "Kotak Bank",
        "INDBNK" to "IndusInd Bank",
        "PAYTM"  to "Paytm",
        "PYTM"   to "Paytm",
        "GPAY"   to "Google Pay",
        "PHONEPE" to "PhonePe",
        "YESBNK" to "Yes Bank",
        "IDFCFB" to "IDFC First Bank",
    )

    private val CREDIT_KEYWORDS = listOf(
        "CREDITED", "RECEIVED", "CREDIT", "DEPOSITED", "MONEY RECEIVED",
        "ADDED TO YOUR", "RECEIVED RS", "RECEIVED INR", "HAS BEEN CREDITED",
        "CREDITED TO", "CREDITED IN", "RECEIVED FROM", "RECEIVED PAYMENT",
        " CR ", " CR."
    )

    private val DEBIT_KEYWORDS = listOf(
        "DEBITED", "SENT RS", "PAID TO", "TRANSFERRED",
        "DEDUCTED", "MONEY SENT", "WITHDRAWN", " DR ", " DR."
    )

    private val EXCLUSION_KEYWORDS = listOf(
        "OTP", "ONE TIME PASSWORD", "VERIFY", "VERIFICATION",
        "PROMO", "OFFER", "APPLY", "LOAN", "EMI",
        "CREDIT CARD", "LIMIT", "MINIMUM DUE"
    )

    private val AMOUNT_PATTERN = Regex("""(?:RS|₹|INR)\.?\s*([0-9,]+\.?[0-9]*)""", RegexOption.IGNORE_CASE)
    private val AMOUNT_PATTERN_REV = Regex("""([0-9,]+\.?[0-9]*)\s*(?:RS|₹|INR)""", RegexOption.IGNORE_CASE)
    private val FROM_PATTERN = Regex("""(?:from|by|sender|payee)\s+([A-Za-z0-9@._\s]{2,30}?)(?:\s+(?:on|at|ref|to|via|has|is|\.)|$)""", RegexOption.IGNORE_CASE)
    private val VPA_PATTERN = Regex("""VPA\s+([a-zA-Z0-9._]+@[a-zA-Z]+)""", RegexOption.IGNORE_CASE)
    private val GENERIC_FROM = Regex("""from\s+([^.,(]+)""", RegexOption.IGNORE_CASE)
    private val REF_PATTERN = Regex("""(?:ref|txn|utr|imps)[\s.:#]*([A-Z0-9]{8,20})""", RegexOption.IGNORE_CASE)

    fun parse(sender: String, body: String): PaymentInfo? {
        if (body.length < 10) return null
        val upper = body.uppercase()

        // Filter exclusions
        if (EXCLUSION_KEYWORDS.any { upper.contains(it) }) return null

        // Must have amount
        if (!AMOUNT_PATTERN.containsMatchIn(body) && !AMOUNT_PATTERN_REV.containsMatchIn(body)) return null

        // Must have credit or debit keyword
        val isCredit = CREDIT_KEYWORDS.any { upper.contains(it) }
        val isDebit = DEBIT_KEYWORDS.any { upper.contains(it) }
        if (!isCredit && !isDebit) return null

        val amount = extractAmount(body) ?: return null
        val type = if (isCredit) "CREDIT" else "DEBIT"

        return PaymentInfo(
            type = type,
            amount = amount,
            sender = extractSender(body),
            bank = identifyBank(sender),
            refNumber = REF_PATTERN.find(body)?.groupValues?.get(1)
        )
    }

    private fun extractAmount(body: String): Double? {
        val clean = body.replace(",", "")
        AMOUNT_PATTERN.find(clean)?.groupValues?.get(1)?.toDoubleOrNull()?.takeIf { it > 0 }?.let { return it }
        AMOUNT_PATTERN_REV.find(clean)?.groupValues?.get(1)?.toDoubleOrNull()?.takeIf { it > 0 }?.let { return it }
        return null
    }

    private fun extractSender(body: String): String {
        FROM_PATTERN.find(body)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        VPA_PATTERN.find(body)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        GENERIC_FROM.find(body)?.groupValues?.get(1)?.trim()?.takeIf {
            it.isNotEmpty() && it.length < 40 && !it.uppercase().startsWith("A/C") && !it.uppercase().startsWith("ACCOUNT")
        }?.let { return it }
        return ""
    }

    private fun identifyBank(sender: String): String {
        val upper = sender.uppercase().trim()
        for ((code, name) in BANK_MAP) {
            if (upper.contains(code)) return name
        }
        val match = Regex("""^[A-Z]{2}-([A-Z0-9]+)""").find(upper)
        return match?.groupValues?.get(1) ?: "Bank"
    }
}
