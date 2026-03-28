package com.edgepay.app.widget

import android.app.*
import android.content.*
import android.graphics.*
import android.os.*
import android.provider.Telephony
import android.speech.tts.TextToSpeech
import android.telephony.SmsMessage
import android.util.DisplayMetrics
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import com.edgepay.app.MainActivity
import com.edgepay.app.R
import java.text.NumberFormat
import java.util.*

class PaymentWidgetService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val CHANNEL_ID = "edgepay_widget_channel"
        const val NOTIFICATION_ID = 8001
        const val ACTION_STOP = "com.edgepay.app.widget.STOP"
        const val ACTION_DISMISS_OVERLAY = "com.edgepay.app.widget.DISMISS"
        const val EXTRA_LANGUAGE = "language"
        const val EXTRA_ANNOUNCE_CREDITS = "announceCredits"
        const val EXTRA_ANNOUNCE_DEBITS = "announceDebits"

        var isRunning = false
    }

    // ── TTS ─────────────────────────────────────────────────────────
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // ── SMS Receiver ─────────────────────────────────────────────────
    private var smsReceiver: BroadcastReceiver? = null

    // ── Overlay Widget ───────────────────────────────────────────────
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var overlayHandler: Handler? = null
    private var dismissRunnable: Runnable? = null

    // ── Config ───────────────────────────────────────────────────────
    private var language = "en"
    private var announceCredits = true
    private var announceDebits = false

    // ── Recent announcements (dedup 30s) ─────────────────────────────
    private val recentKeys = ArrayDeque<Pair<String, Long>>()
    
    // ── History of payments for widget ──────────────────────────────
    private val sessionPayments = mutableListOf<PaymentInfo>()

    // ─────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        tts = TextToSpeech(this, this)
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayHandler = Handler(Looper.getMainLooper())
        registerSmsReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        language = intent?.getStringExtra(EXTRA_LANGUAGE) ?: language
        announceCredits = intent?.getBooleanExtra(EXTRA_ANNOUNCE_CREDITS, true) ?: announceCredits
        announceDebits = intent?.getBooleanExtra(EXTRA_ANNOUNCE_DEBITS, false) ?: announceDebits

        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        unregisterSmsReceiver()
        removeOverlay()
        tts?.stop()
        tts?.shutdown()
        overlayHandler?.removeCallbacksAndMessages(null)
    }

    // ─────────────────────────────────────────────────────────────────
    // TTS init
    // ─────────────────────────────────────────────────────────────────

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val locale = if (language == "hi") Locale("hi", "IN") else Locale("en", "IN")
            val result = tts?.setLanguage(locale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.setLanguage(Locale.ENGLISH)
            }
            tts?.setSpeechRate(0.9f)
            tts?.setPitch(1.0f)
            ttsReady = true
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // SMS Receiver
    // ─────────────────────────────────────────────────────────────────

    private fun registerSmsReceiver() {
        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                for (msg in messages) {
                    val sender = msg.displayOriginatingAddress ?: ""
                    val body = msg.displayMessageBody ?: ""
                    processIncomingSms(sender, body)
                }
            }
        }

        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(smsReceiver, filter)
        }
    }

    private fun unregisterSmsReceiver() {
        smsReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
            smsReceiver = null
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Payment Detection & Announcement
    // ─────────────────────────────────────────────────────────────────

    private fun processIncomingSms(sender: String, body: String) {
        val info = SmsPaymentParser.parse(sender, body) ?: return

        // Dedup within 30 seconds
        val key = "${info.type}_${info.amount}_${info.sender}"
        val now = System.currentTimeMillis()
        recentKeys.removeAll { now - it.second > 30_000 }
        if (recentKeys.any { it.first == key }) return
        recentKeys.addLast(key to now)

        // Check type filter
        if (info.type == "CREDIT" && !announceCredits) return
        if (info.type == "DEBIT" && !announceDebits) return

        // Show overlay on main thread
        overlayHandler?.post {
            showOverlayWidget(info)
            announcePayment(info)
            EdgePayHomeWidget.updateLastPayment(this, info.amount, info.sender, info.type, info.bank)
        }
    }

    private fun announcePayment(info: PaymentInfo) {
        if (!ttsReady) return
        val text = buildAnnouncementText(info)
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "edgepay_payment")
    }

    private fun buildAnnouncementText(info: PaymentInfo): String {
        val formatted = formatAmount(info.amount)
        return if (language == "hi") {
            if (info.type == "CREDIT") {
                val from = if (info.sender.isNotEmpty()) " ${info.sender} से" else ""
                "EdgePay। भुगतान प्राप्त हुआ। $formatted रुपये$from।"
            } else {
                val to = if (info.sender.isNotEmpty()) " ${info.sender} को" else ""
                "EdgePay। भुगतान भेजा गया। $formatted रुपये$to।"
            }
        } else {
            if (info.type == "CREDIT") {
                val from = if (info.sender.isNotEmpty()) " from ${info.sender}" else ""
                "EdgePay. Payment received. $formatted rupees$from."
            } else {
                val to = if (info.sender.isNotEmpty()) " to ${info.sender}" else ""
                "EdgePay. Payment sent. $formatted rupees$to."
            }
        }
    }

    private fun formatAmount(amount: Double): String {
        return if (amount == Math.floor(amount)) {
            amount.toInt().toString()
        } else {
            String.format("%.2f", amount)
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Overlay Widget
    // ─────────────────────────────────────────────────────────────────

    private fun showOverlayWidget(info: PaymentInfo) {
        // Add to history (keep recent 10 max)
        sessionPayments.add(0, info)
        if (sessionPayments.size > 10) sessionPayments.removeLast()

        val wm = windowManager ?: return

        // If overlay view exists, just update the layout to avoid screen flashing
        if (overlayView != null) {
            updateOverlayData()
            return
        }

        val inflater = LayoutInflater.from(this)
        val view = inflater.inflate(R.layout.widget_payment_overlay, null)

        val btnDismiss = view.findViewById<TextView>(R.id.widget_dismiss)
        btnDismiss.setOnClickListener { removeOverlay() }

        // Open app on widget tap
        view.findViewById<View>(R.id.widget_open_app).setOnClickListener {
            val launchIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(launchIntent)
            removeOverlay()
        }

        // Window layout params
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 120  // offset from top a bit lower so it looks like a drop-down widget
        }

        // Make draggable
        view.setOnTouchListener(object : View.OnTouchListener {
            private var initX = 0; private var initY = 0
            private var initTouchX = 0f; private var initTouchY = 0f
            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initX = params.x; initY = params.y
                        initTouchX = event.rawX; initTouchY = event.rawY
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initX + (event.rawX - initTouchX).toInt()
                        params.y = initY + (event.rawY - initTouchY).toInt()
                        wm.updateViewLayout(view, params)
                    }
                    MotionEvent.ACTION_UP -> {
                        val dx = Math.abs(event.rawX - initTouchX)
                        val dy = Math.abs(event.rawY - initTouchY)
                        if (dx < 10 && dy < 10) v.performClick()
                    }
                }
                return true
            }
        })

        overlayView = view
        wm.addView(view, params)
        updateOverlayData()
    }

    private fun updateOverlayData() {
        val view = overlayView ?: return
        val inflater = LayoutInflater.from(this)
        val container = view.findViewById<LinearLayout>(R.id.history_list)
        container.removeAllViews()

        for (itemInfo in sessionPayments) {
            val itemView = inflater.inflate(R.layout.widget_payment_item, container, false)
            val isCredit = itemInfo.type == "CREDIT"
            
            val tvType = itemView.findViewById<TextView>(R.id.item_type)
            val tvAmount = itemView.findViewById<TextView>(R.id.item_amount)
            val tvSender = itemView.findViewById<TextView>(R.id.item_sender)
            val tvBank = itemView.findViewById<TextView>(R.id.item_bank)

            tvType.text = if (isCredit) "⬇ Received" else "⬆ Sent"
            tvType.setTextColor(if (isCredit) 0xFF30D158.toInt() else 0xFFFF453A.toInt())
            
            tvAmount.text = "₹${itemInfo.amount.let { if (it == Math.floor(it)) it.toInt().toString() else String.format("%.2f", it) }}"
            tvAmount.setTextColor(if (isCredit) 0xFF30D158.toInt() else 0xFFFF453A.toInt())
            
            tvSender.text = if (itemInfo.sender.isNotEmpty()) itemInfo.sender else itemInfo.bank
            tvBank.text = itemInfo.bank
            
            container.addView(itemView)
            
            // Add a small divider between items
            val divider = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1).apply {
                    setMargins(0, 8, 0, 8)
                }
                setBackgroundColor(0x18FFFFFF)
            }
            container.addView(divider)
        }
    }

    private fun removeOverlay() {
        dismissRunnable?.let { overlayHandler?.removeCallbacks(it) }
        dismissRunnable = null
        overlayView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            overlayView = null
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Notification & Channel
    // ─────────────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "EdgePay Payment Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors incoming payments and announces them"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, PaymentWidgetService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("EdgePay Active")
            .setContentText("Monitoring payments • Tap to open")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .build()
    }
}
