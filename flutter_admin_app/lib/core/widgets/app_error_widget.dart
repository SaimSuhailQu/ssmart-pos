import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';

/// Reusable App Error Widget aligned with Noir Graphite theme
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
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.errorRed.withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppTheme.errorRed.withValues(alpha: 0.25),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.errorRed.withValues(alpha: 0.1),
                    blurRadius: 20,
                  ),
                ],
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: AppTheme.errorRed,
              ),
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              message,
              style: GraphiteTheme.screenTitle.copyWith(fontSize: 18),
              textAlign: TextAlign.center,
            ),
            if (error != null && error!.isNotEmpty) ...[
              const SizedBox(height: AppTheme.spacingM),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GraphiteTheme.graphiteCard,
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  border: Border.all(color: GraphiteTheme.cardBorder),
                ),
                child: SelectableText(
                  error!,
                  style: GraphiteTheme.monoText.copyWith(
                    color: GraphiteTheme.slate,
                    fontSize: 11,
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
                label: const Text('Retry Connection'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: GraphiteTheme.platinum,
                  foregroundColor: GraphiteTheme.graphiteDeep,
                  elevation: 0,
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
