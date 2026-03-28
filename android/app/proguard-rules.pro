# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# EdgePay Widget / Background Service
-keep class com.edgepay.app.widget.** { *; }
-keep class com.edgepay.app.sms.** { *; }
-keep class com.edgepay.app.ussd.** { *; }
-keep class com.edgepay.app.soundbox.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
