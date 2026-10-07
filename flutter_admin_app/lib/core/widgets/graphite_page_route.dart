import 'package:flutter/material.dart';

/// The app-wide page transition: a quick fade with a subtle rise + settle.
///
/// Replaces the stock iOS slide so every push in the app feels like one
/// calm, premium motion system. 300ms, ease-out — fast enough to never
/// feel in the way.
class GraphitePageRoute<T> extends PageRouteBuilder<T> {
  GraphitePageRoute({required WidgetBuilder builder, RouteSettings? settings})
      : super(
          settings: settings,
          transitionDuration: const Duration(milliseconds: 300),
          reverseTransitionDuration: const Duration(milliseconds: 240),
          pageBuilder: (context, animation, secondaryAnimation) =>
              builder(context),
          transitionsBuilder:
              (context, animation, secondaryAnimation, child) {
            final fade = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            );
            final rise = Tween<Offset>(
              begin: const Offset(0, 0.04),
              end: Offset.zero,
            ).animate(fade);
            final settle = Tween<double>(begin: 0.985, end: 1.0).animate(fade);
            return FadeTransition(
              opacity: fade,
              child: SlideTransition(
                position: rise,
                child: ScaleTransition(scale: settle, child: child),
              ),
            );
          },
        );
}

/// Push a screen with the graphite transition.
Future<T?> graphitePush<T>(BuildContext context, Widget screen) {
  return Navigator.push<T>(
    context,
    GraphitePageRoute<T>(builder: (_) => screen),
  );
}
