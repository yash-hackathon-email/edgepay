package com.edgepay.app.sms

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class SmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), PermissionListener {

    private var smsReceiver: BroadcastReceiver? = null
    private var permissionPromise: Promise? = null

    companion object {
        const val NAME = "SmsModule"
        const val SMS_RECEIVED_EVENT = "onSmsReceived"
        const val SMS_SENT_EVENT = "onSmsSent"
        const val SMS_PERMISSION_REQUEST_CODE = 1001
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            if (ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.SEND_SMS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("PERMISSION_DENIED", "SMS permission not granted")
                return
            }

            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactApplicationContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            }

            // Send event success
            sendEvent(SMS_SENT_EVENT, Arguments.createMap().apply {
                putString("status", "SENT")
                putString("phoneNumber", phoneNumber)
                putString("message", message)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            })

            // Resolve promise with status result
            promise.resolve(Arguments.createMap().apply {
                putString("status", "SENT")
                putString("phoneNumber", phoneNumber)
                putString("message", message)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            })
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", "Failed to send SMS: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startSmsListener(promise: Promise) {
        try {
            if (smsReceiver != null) {
                promise.resolve("Listener already active")
                return
            }

            smsReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    if (intent?.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
                        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                        for (smsMessage in messages) {
                            val smsData = Arguments.createMap().apply {
                                putString("sender", smsMessage.displayOriginatingAddress)
                                putString("body", smsMessage.displayMessageBody)
                                putDouble("timestamp", smsMessage.timestampMillis.toDouble())
                            }
                            sendEvent(SMS_RECEIVED_EVENT, smsData)
                        }
                    }
                }
            }

            val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
            filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactApplicationContext.registerReceiver(
                    smsReceiver,
                    filter,
                    Context.RECEIVER_NOT_EXPORTED
                )
            } else {
                reactApplicationContext.registerReceiver(smsReceiver, filter)
            }

            promise.resolve("SMS listener started")
        } catch (e: Exception) {
            promise.reject("LISTENER_ERROR", "Failed to start SMS listener: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopSmsListener(promise: Promise) {
        try {
            smsReceiver?.let {
                reactApplicationContext.unregisterReceiver(it)
                smsReceiver = null
            }
            promise.resolve("SMS listener stopped")
        } catch (e: Exception) {
            promise.reject("LISTENER_ERROR", "Failed to stop SMS listener: ${e.message}", e)
        }
    }

    @ReactMethod
    fun requestSmsPermissions(promise: Promise) {
        val activity: Activity = getCurrentActivity() ?: run {
            promise.reject("NO_ACTIVITY", "No activity found")
            return
        }

        val permissions = arrayOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS
        )

        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(reactApplicationContext, it) ==
                PackageManager.PERMISSION_GRANTED
        }

        if (allGranted) {
            val result = Arguments.createMap().apply {
                putBoolean("granted", true)
            }
            promise.resolve(result)
            return
        }

        permissionPromise = promise
        if (activity is PermissionAwareActivity) {
            activity.requestPermissions(permissions, SMS_PERMISSION_REQUEST_CODE, this)
        } else {
            ActivityCompat.requestPermissions(activity, permissions, SMS_PERMISSION_REQUEST_CODE)
        }
    }

    @ReactMethod
    fun checkSmsPermissions(promise: Promise) {
        val sendGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val receiveGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val readGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED

        val result = Arguments.createMap().apply {
            putBoolean("send", sendGranted)
            putBoolean("receive", receiveGranted)
            putBoolean("read", readGranted)
            putBoolean("allGranted", sendGranted && receiveGranted && readGranted)
        }
        promise.resolve(result)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): Boolean {
        if (requestCode == SMS_PERMISSION_REQUEST_CODE) {
            val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            val result = Arguments.createMap().apply {
                putBoolean("granted", allGranted)
            }
            permissionPromise?.resolve(result)
            permissionPromise = null
            return true
        }
        return false
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun readRecentSms(count: Int, promise: Promise) {
        try {
            if (ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.READ_SMS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
                return
            }

            val cursor = reactApplicationContext.contentResolver.query(
                android.net.Uri.parse("content://sms/inbox"),
                arrayOf("address", "body", "date"),
                null,
                null,
                "date DESC LIMIT $count"
            )

            val messages = Arguments.createArray()
            cursor?.use {
                while (it.moveToNext()) {
                    val sms = Arguments.createMap().apply {
                        putString("sender", it.getString(0) ?: "")
                        putString("body", it.getString(1) ?: "")
                        putDouble("timestamp", (it.getLong(2)).toDouble())
                    }
                    messages.pushMap(sms)
                }
            }

            promise.resolve(messages)
        } catch (e: Exception) {
            promise.reject("READ_SMS_ERROR", "Failed to read SMS: ${e.message}", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        smsReceiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (_: Exception) {}
            smsReceiver = null
        }
    }
}