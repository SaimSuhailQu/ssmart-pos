import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';

/// Reusable App Loading Indicator with Platinum aesthetic
class AppLoadingIndicator extends StatelessWidget {
  final String message;

  const AppLoadingIndicator({
    super.key,
    this.message = 'Loading...',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation<Color>(GraphiteTheme.platinum),
            ),
          ),
          const SizedBox(height: AppTheme.spacingM),
          Text(
            message,
            style: GraphiteTheme.caption.copyWith(
              color: GraphiteTheme.slate,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
