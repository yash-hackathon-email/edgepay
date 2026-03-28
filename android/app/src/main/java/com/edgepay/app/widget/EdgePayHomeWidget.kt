package com.edgepay.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import com.edgepay.app.MainActivity
import com.edgepay.app.R
import java.text.SimpleDateFormat
import java.util.*

/**
 * EdgePay Home Screen Widget — droppable from widget picker.
 *
 * Shows:
 *  • Last payment amount & sender
 *  • Service running status (active/stopped)
 *  • Tap to open app
 *  • Toggle button to start/stop the background monitor
 *
 * Auto-updates every 30 minutes (configured in widget_info.xml).
 */
class EdgePayHomeWidget : AppWidgetProvider() {

    companion object {
        const val ACTION_TOGGLE_SERVICE = "com.edgepay.app.widget.TOGGLE_SERVICE"
        const val ACTION_REFRESH = "com.edgepay.app.widget.REFRESH"
        const val PREFS_NAME = "edgepay_widget_prefs"
        const val KEY_LAST_AMOUNT = "last_amount"
        const val KEY_LAST_SENDER = "last_sender"
        const val KEY_LAST_TYPE = "last_type"
        const val KEY_LAST_BANK = "last_bank"
        const val KEY_LAST_TIME = "last_time"

        /**
         * Call this from PaymentWidgetService when a payment is detected
         * to push updates to all home-screen widget instances.
         */
        fun updateLastPayment(
            context: Context,
            amount: Double,
            sender: String,
            type: String,
            bank: String
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_LAST_AMOUNT, formatAmount(amount))
                .putString(KEY_LAST_SENDER, sender.ifEmpty { "Unknown" })
                .putString(KEY_LAST_TYPE, type)
                .putString(KEY_LAST_BANK, bank)
                .putLong(KEY_LAST_TIME, System.currentTimeMillis())
                .apply()

            // Trigger widget refresh
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayHomeWidget::class.java))
            val intent = Intent(context, EdgePayHomeWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        private fun formatAmount(amount: Double): String {
            return if (amount == Math.floor(amount)) {
                "₹${amount.toInt()}"
            } else {
                "₹${String.format("%.2f", amount)}"
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_TOGGLE_SERVICE -> {
                if (PaymentWidgetService.isRunning) {
                    // Stop service
                    val stopIntent = Intent(context, PaymentWidgetService::class.java).apply {
                        action = PaymentWidgetService.ACTION_STOP
                    }
                    context.stopService(stopIntent)
                } else {
                    // Start service
                    val startIntent = Intent(context, PaymentWidgetService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(startIntent)
                    } else {
                        context.startService(startIntent)
                    }
                }
                // Refresh widget after a short delay to reflect new state
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    refreshAllWidgets(context)
                }, 500)
            }
            ACTION_REFRESH -> {
                refreshAllWidgets(context)
            }
        }
    }

    override fun onEnabled(context: Context) {
        // First widget placed — auto-start the monitor service
        if (!PaymentWidgetService.isRunning) {
            val intent = Intent(context, PaymentWidgetService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onDisabled(context: Context) {
        // Last widget removed
    }

    // ─────────────────────────────────────────────────────────────────
    // Widget rendering
    // ─────────────────────────────────────────────────────────────────

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_home_screen)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // ── Service status ──
        val isActive = PaymentWidgetService.isRunning
        views.setTextViewText(
            R.id.home_widget_status,
            if (isActive) "● Active" else "○ Stopped"
        )
        views.setTextColor(
            R.id.home_widget_status,
            if (isActive) 0xFF30D158.toInt() else 0xFF8E8E93.toInt()
        )

        // ── Last payment data ──
        val lastAmount = prefs.getString(KEY_LAST_AMOUNT, null)
        val lastSender = prefs.getString(KEY_LAST_SENDER, null)
        val lastType = prefs.getString(KEY_LAST_TYPE, null)
        val lastTime = prefs.getLong(KEY_LAST_TIME, 0)

        if (lastAmount != null && lastTime > 0) {
            val isCredit = lastType == "CREDIT"
            views.setTextViewText(R.id.home_widget_amount, lastAmount)
            views.setTextColor(
                R.id.home_widget_amount,
                if (isCredit) 0xFF30D158.toInt() else 0xFFFF453A.toInt()
            )
            views.setTextViewText(
                R.id.home_widget_type_label,
                if (isCredit) "⬇ Received" else "⬆ Sent"
            )
            views.setTextViewText(
                R.id.home_widget_sender,
                if (isCredit) "from $lastSender" else "to $lastSender"
            )
            val sdf = SimpleDateFormat("hh:mm a", Locale.getDefault())
            views.setTextViewText(
                R.id.home_widget_time,
                sdf.format(Date(lastTime))
            )
        } else {
            views.setTextViewText(R.id.home_widget_amount, "₹ —")
            views.setTextColor(R.id.home_widget_amount, 0xFFFFFFFF.toInt())
            views.setTextViewText(R.id.home_widget_type_label, "No payments yet")
            views.setTextViewText(R.id.home_widget_sender, "Waiting for transactions...")
            views.setTextViewText(R.id.home_widget_time, "")
        }

        // ── Toggle button text ──
        views.setTextViewText(
            R.id.home_widget_toggle_btn,
            if (isActive) "⏹ Stop Monitor" else "▶ Start Monitor"
        )

        // ── Tap: Open app ──
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPending = PendingIntent.getActivity(
            context, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.home_widget_container, openPending)

        // ── Toggle button: start/stop service ──
        val toggleIntent = Intent(context, EdgePayHomeWidget::class.java).apply {
            action = ACTION_TOGGLE_SERVICE
        }
        val togglePending = PendingIntent.getBroadcast(
            context, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.home_widget_toggle_btn, togglePending)

        // ── Refresh button ──
        val refreshIntent = Intent(context, EdgePayHomeWidget::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, 2, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.home_widget_refresh_btn, refreshPending)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun refreshAllWidgets(context: Context) {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayHomeWidget::class.java))
        for (id in ids) {
            updateWidget(context, mgr, id)
        }
    }
}
