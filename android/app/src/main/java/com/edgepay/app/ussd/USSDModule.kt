package com.edgepay.app.ussd

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class USSDModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "USSDModule"
        const val USSD_RESPONSE_EVENT = "onUssdResponse"
        private const val PERMISSION_REQUEST_CODE = 2001
    }

    override fun getName(): String = NAME

    /**
     * Send a USSD request using TelephonyManager.sendUssdRequest()
     * This is the core function that dials USSD codes like *99*1*receiver*amount#
     */
    @ReactMethod
    fun sendUssdRequest(ussdCode: String, promise: Promise) {
        try {
            // Check CALL_PHONE permission
            if (ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.CALL_PHONE
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("PERMISSION_DENIED", "CALL_PHONE permission not granted")
                return
            }

            val telephonyManager = reactApplicationContext.getSystemService(
                Context.TELEPHONY_SERVICE
            ) as? TelephonyManager

            if (telephonyManager == null) {
                promise.reject("NO_TELEPHONY", "TelephonyManager not available on this device")
                return
            }

            // Validate USSD code format
            if (!ussdCode.startsWith("*") || !ussdCode.endsWith("#")) {
                promise.reject("INVALID_USSD", "USSD code must start with * and end with #")
                return
            }

            val handler = Handler(Looper.getMainLooper())

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                telephonyManager.sendUssdRequest(
                    ussdCode,
                    object : TelephonyManager.UssdResponseCallback() {
                        override fun onReceiveUssdResponse(
                            telephonyManager: TelephonyManager,
                            request: String,
                            response: CharSequence
                        ) {
                            val result = Arguments.createMap().apply {
                                putString("status", "SUCCESS")
                                putString("request", request)
                                putString("response", response.toString())
                                putDouble("timestamp", System.currentTimeMillis().toDouble())
                            }

                            // Emit event for listeners
                            sendEvent(USSD_RESPONSE_EVENT, Arguments.createMap().apply {
                                putString("type", "response")
                                putString("request", request)
                                putString("response", response.toString())
                                putDouble("timestamp", System.currentTimeMillis().toDouble())
                            })

                            promise.resolve(result)
                        }

                        override fun onReceiveUssdResponseFailed(
                            telephonyManager: TelephonyManager,
                            request: String,
                            failureCode: Int
                        ) {
                            val failureReason = when (failureCode) {
                                TelephonyManager.USSD_ERROR_SERVICE_UNAVAIL ->
                                    "USSD service unavailable"
                                TelephonyManager.USSD_RETURN_FAILURE ->
                                    "USSD request failed"
                                else -> "Unknown USSD error (code: $failureCode)"
                            }

                            // Emit failure event
                            sendEvent(USSD_RESPONSE_EVENT, Arguments.createMap().apply {
                                putString("type", "error")
                                putString("request", request)
                                putString("error", failureReason)
                                putInt("failureCode", failureCode)
                                putDouble("timestamp", System.currentTimeMillis().toDouble())
                            })

                            promise.reject(
                                "USSD_FAILED",
                                failureReason
                            )
                        }
                    },
                    handler
                )
            } else {
                // For API < 26, we cannot use sendUssdRequest
                promise.reject(
                    "API_TOO_LOW",
                    "sendUssdRequest requires Android 8.0 (API 26) or higher. Current API: ${Build.VERSION.SDK_INT}"
                )
            }
        } catch (e: SecurityException) {
            promise.reject("SECURITY_ERROR", "Permission denied: ${e.message}")
        } catch (e: Exception) {
            promise.reject("USSD_ERROR", "Failed to send USSD request: ${e.message}")
        }
    }

    /**
     * Dial a USSD code using the phone dialer (fallback method)
     */
    @ReactMethod
    fun dialUssdCode(ussdCode: String, promise: Promise) {
        try {
            val intent = android.content.Intent(
                android.content.Intent.ACTION_CALL,
                android.net.Uri.parse("tel:${android.net.Uri.encode(ussdCode)}")
            )
            intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK

            if (ContextCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.CALL_PHONE
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                promise.reject("PERMISSION_DENIED", "CALL_PHONE permission not granted")
                return
            }

            reactApplicationContext.startActivity(intent)

            promise.resolve(Arguments.createMap().apply {
                putString("status", "DIALED")
                putString("ussdCode", ussdCode)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            })
        } catch (e: Exception) {
            promise.reject("DIAL_ERROR", "Failed to dial USSD code: ${e.message}")
        }
    }

    /**
     * Check if CALL_PHONE permission is granted
     */
    @ReactMethod
    fun checkPermission(promise: Promise) {
        val callGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        val phoneStateGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(Arguments.createMap().apply {
            putBoolean("callPhone", callGranted)
            putBoolean("readPhoneState", phoneStateGranted)
            putBoolean("allGranted", callGranted && phoneStateGranted)
        })
    }

    /**
     * Request CALL_PHONE and READ_PHONE_STATE permissions
     */
    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val activity: Activity? = getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity found")
            return
        }

        val permissions = arrayOf(
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE
        )

        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(reactApplicationContext, it) ==
                PackageManager.PERMISSION_GRANTED
        }

        if (allGranted) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("granted", true)
            })
            return
        }

        // Request permissions
        if (activity is PermissionAwareActivity) {
            activity.requestPermissions(
                permissions,
                PERMISSION_REQUEST_CODE,
                object : PermissionListener {
                    override fun onRequestPermissionsResult(
                        requestCode: Int,
                        permissions: Array<String>,
                        grantResults: IntArray
                    ): Boolean {
                        if (requestCode == PERMISSION_REQUEST_CODE) {
                            val granted = grantResults.isNotEmpty() && grantResults.all {
                                it == PackageManager.PERMISSION_GRANTED
                            }
                            promise.resolve(Arguments.createMap().apply {
                                putBoolean("granted", granted)
                            })
                            return true
                        }
                        return false
                    }
                }
            )
        } else {
            ActivityCompat.requestPermissions(
                activity, permissions, PERMISSION_REQUEST_CODE
            )
            // Can't easily get the result here, resolve with false and note
            promise.resolve(Arguments.createMap().apply {
                putBoolean("granted", false)
                putString("note", "Permission dialog shown, check again after user responds")
            })
        }
    }

    /**
     * Get device telephony info (SIM state, operator)
     */
    @ReactMethod
    fun getTelephonyInfo(promise: Promise) {
        try {
            val telephonyManager = reactApplicationContext.getSystemService(
                Context.TELEPHONY_SERVICE
            ) as? TelephonyManager

            if (telephonyManager == null) {
                promise.reject("NO_TELEPHONY", "TelephonyManager not available")
                return
            }

            promise.resolve(Arguments.createMap().apply {
                putInt("simState", telephonyManager.simState)
                putBoolean("isSimReady", telephonyManager.simState == TelephonyManager.SIM_STATE_READY)
                putString("networkOperator", telephonyManager.networkOperatorName ?: "Unknown")
                putString("simOperator", telephonyManager.simOperatorName ?: "Unknown")
                putInt("phoneType", telephonyManager.phoneType)
                putInt("networkType", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    telephonyManager.dataNetworkType
                } else {
                    @Suppress("DEPRECATION")
                    telephonyManager.networkType
                })
            })
        } catch (e: Exception) {
            promise.reject("TELEPHONY_ERROR", "Failed to get telephony info: ${e.message}")
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
