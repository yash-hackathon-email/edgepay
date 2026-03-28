package com.edgepay.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.edgepay.app.MainActivity
import com.edgepay.app.R
import java.util.*

/**
 * Expense Tracker Widget — 4x1 or 2x2
 * Tracks monthly pocket money/salary and countdown to reset.
 */
class EdgePayExpenseWidget : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME = "edgepay_expense_prefs"
        const val KEY_SPENT = "expense_spent"
        const val KEY_BUDGET = "expense_budget"
        const val KEY_RESET_DAY = "expense_reset_day"

        fun updateExpense(context: Context, spent: Double, budget: Double, day: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putFloat(KEY_SPENT, spent.toFloat())
                .putFloat(KEY_BUDGET, budget.toFloat())
                .putInt(KEY_RESET_DAY, day)
                .apply()

            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, EdgePayExpenseWidget::class.java))
            for (id in ids) {
                updateWidget(context, mgr, id)
            }
        }

        private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_expense_tracker)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val spent = prefs.getFloat(KEY_SPENT, 0f)
            val budget = prefs.getFloat(KEY_BUDGET, 0f)
            val resetDay = prefs.getInt(KEY_RESET_DAY, 1)

            // Format percentage (Main display)
            val progress = if (budget > 0) (spent / budget * 100).toInt() else 0
            views.setTextViewText(R.id.expense_widget_percent, "$progress%")
            
            // Set hidden or subtle views if needed
            views.setProgressBar(R.id.expense_widget_progress, 100, Math.min(progress, 100), false)
            
            // Status Color based on budget
            if (progress >= 90 && budget > 0) {
                views.setTextColor(R.id.expense_widget_percent, 0xFFFF453A.toInt()) // Red
            } else {
                views.setTextColor(R.id.expense_widget_percent, 0xFFFFFFFF.toInt()) // White
            }

            // Click to open app
            val intent = Intent(context, MainActivity::class.java)
            val pending = PendingIntent.getActivity(context, 202, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.expense_widget_container, pending)

            appWidgetManager.updateAppWidget(id, views)
        }

        private fun calculateDaysUntil(dayOfMonth: Int): Int {
            val now = Calendar.getInstance()
            val target = Calendar.getInstance()
            
            target.set(Calendar.DAY_OF_MONTH, dayOfMonth)
            if (target.before(now)) {
                target.add(Calendar.MONTH, 1)
            }
            
            val diff = target.timeInMillis - now.timeInMillis
            return (diff / (24 * 60 * 60 * 1000)).toInt()
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, appWidgetManager, id)
    }
}
