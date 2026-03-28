package com.edgepay.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.widget.RemoteViews
import com.edgepay.app.MainActivity
import com.edgepay.app.R

/**
 * Goal Tracker Widget — 2x2 Circle Progress
 * Dynamically draws the progress toward the monthly goal amount.
 */
class EdgePayGoalWidget : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME = "edgepay_goal_prefs"
        const val KEY_GOAL_AMOUNT = "goal_total"
        const val KEY_CURRENT_BAL = "goal_balance"

        /**
         * Update the goal data from the App
         */
        fun updateGoal(context: Context, total: Double, current: Double) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putFloat(KEY_GOAL_AMOUNT, total.toFloat())
                .putFloat(KEY_CURRENT_BAL, current.toFloat())
                .apply()

            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayGoalWidget::class.java))
            for (id in ids) {
                updateWidget(context, mgr, id)
            }
        }

        private fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_goal_tracker)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val goal = prefs.getFloat(KEY_GOAL_AMOUNT, 0f)
            val balance = prefs.getFloat(KEY_CURRENT_BAL, 0f)

            // Calculate progress
            val percent = if (goal > 0) ((balance / goal) * 100).toInt() else 0
            val constrained = if (percent > 100) 100 else percent

            // Draw circular progress bitmap
            val bitmap = drawProgressCircle(constrained)
            views.setImageViewBitmap(R.id.goal_widget_circle, bitmap)
            views.setTextViewText(R.id.goal_widget_percent, "$percent%")
            
            // Format labels
            views.setTextViewText(R.id.goal_widget_amount, "₹${balance.toInt()} / ₹${goal.toInt()}")
            
            // Open App on tap
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val pending = PendingIntent.getActivity(
                context, 101, intent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.goal_widget_container, pending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * Low-level drawing function to generate a smooth circular progress bitmap
         */
        private fun drawProgressCircle(percent: Int): Bitmap {
            val size = 200 // Bitmap size (high res)
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.strokeWidth = 20f
            paint.style = Paint.Style.STROKE
            paint.strokeCap = Paint.Cap.ROUND
            
            val rect = RectF(20f, 20f, size.toFloat() - 20f, size.toFloat() - 20f)
            
            // Background track (semi-transparent)
            paint.color = 0x220A84FF.toInt()
            canvas.drawArc(rect, 0f, 360f, false, paint)
            
            // Progress segment
            // Start from top (-90 degrees)
            paint.color = if (percent >= 90) 0xFFFF453A.toInt() else 0xFF0A84FF.toInt()
            canvas.drawArc(rect, -90f, (percent * 360 / 100).toFloat(), false, paint)
            
            return bitmap
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }
}
