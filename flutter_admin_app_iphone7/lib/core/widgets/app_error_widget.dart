import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// Reusable App Error Widget
class AppErrorWidget extends StatelessWidget {
  final String message;
  final String? error;
  final VoidCallback? onRetry;

  const AppErrorWidget({
    super.key,
    required this.message,
    this.error,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: Colors.redAccent,
              ),
            ),
            const SizedBox(height: AppTheme.spacingM),
            Text(
              message,
              style: AppTheme.titleMedium.copyWith(color: Colors.white),
              textAlign: TextAlign.center,
            ),
            if (error != null && error!.isNotEmpty) ...[
              const SizedBox(height: AppTheme.spacingM),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  border: Border.all(color: Colors.white12),
                ),
                child: SelectableText(
                  error!,
                  style: AppTheme.bodySmall.copyWith(
                    color: const Color(0xFFE2E8F0),
                    fontFamily: 'monospace',
                    fontSize: 12,
                  ),
                  textAlign: TextAlign.left,
                ),
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: AppTheme.spacingL),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryCyan,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
