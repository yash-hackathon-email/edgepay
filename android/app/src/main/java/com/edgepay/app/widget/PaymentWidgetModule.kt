package com.edgepay.app.widget

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class PaymentWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PaymentWidgetModule"
    }

    override fun getName(): String = NAME

    // ── Start the background foreground service ──────────────────────
    @ReactMethod
    fun startWidget(options: ReadableMap, promise: Promise) {
        try {
            // On Android 13+ we need OVERLAY permission for the floating widget
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                // Service will still run and announce via TTS — overlay is optional
                // We resolve true so the app can prompt for overlay permission separately
            }

            val lang = if (options.hasKey("language")) options.getString("language") ?: "en" else "en"
            val credits = if (options.hasKey("announceCredits")) options.getBoolean("announceCredits") else true
            val debits = if (options.hasKey("announceDebits")) options.getBoolean("announceDebits") else false

            val intent = Intent(reactContext, PaymentWidgetService::class.java).apply {
                putExtra(PaymentWidgetService.EXTRA_LANGUAGE, lang)
                putExtra(PaymentWidgetService.EXTRA_ANNOUNCE_CREDITS, credits)
                putExtra(PaymentWidgetService.EXTRA_ANNOUNCE_DEBITS, debits)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_WIDGET_ERROR", "Failed to start widget service: ${e.message}", e)
        }
    }

    // ── Stop the service ─────────────────────────────────────────────
    @ReactMethod
    fun stopWidget(promise: Promise) {
        try {
            val intent = Intent(reactContext, PaymentWidgetService::class.java).apply {
                action = PaymentWidgetService.ACTION_STOP
            }
            reactContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_WIDGET_ERROR", "Failed to stop widget service: ${e.message}", e)
        }
    }

    // ── Check if service is running ──────────────────────────────────
    @ReactMethod
    fun isWidgetRunning(promise: Promise) {
        promise.resolve(PaymentWidgetService.isRunning)
    }

    // ── Check if SYSTEM_ALERT_WINDOW (overlay) permission is granted ─
    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(reactContext)
        } else {
            true
        }
        promise.resolve(granted)
    }

    // ── Request overlay permission (open system settings) ────────────
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OVERLAY_PERMISSION_ERROR", e.message, e)
        }
    }

    // ── Update config while running ──────────────────────────────────
    @ReactMethod
    fun updateConfig(options: ReadableMap, promise: Promise) {
        // Re-send intent — service handles it in onStartCommand
        startWidget(options, promise)
    }

    // ── Sync goal amount and current balance across to widget ────────
    @ReactMethod
    fun syncGoalAmount(goal: Double, balance: Double, promise: Promise) {
        try {
            EdgePayGoalWidget.updateGoal(reactContext, goal, balance)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SYNC_GOAL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun syncExpenseData(spent: Double, budget: Double, day: Int, promise: Promise) {
        try {
            EdgePayExpenseWidget.updateExpense(reactContext, spent, budget, day)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SYNC_EXPENSE_ERROR", e.message, e)
        }
    }

    // Required for RN event emitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
