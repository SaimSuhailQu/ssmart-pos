import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../../features/quick_entry/screens/quick_entry_screen.dart';

/// Listens for `ssmartpos://quick-entry?action=<loan|wasool|order|expense>`
/// deep links (from the iOS home-screen widget) and opens QuickEntryScreen.
///
/// Placed inside the authenticated branch of the widget tree, so widget taps
/// while logged out are ignored — Quick Entry needs an owner session to
/// write to the ledger.
class DeepLinkHandler extends StatefulWidget {
  final Widget child;
  const DeepLinkHandler({super.key, required this.child});

  @override
  State<DeepLinkHandler> createState() => _DeepLinkHandlerState();
}

class _DeepLinkHandlerState extends State<DeepLinkHandler> {
  StreamSubscription<Uri>? _sub;
  final _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    // Cold start (app launched from widget tap)
    _appLinks.getInitialLink().then(_handleUri).catchError((_) {});
    // Warm (app already running)
    _sub = _appLinks.uriLinkStream.listen(_handleUri, onError: (_) {});
  }

  void _handleUri(Uri? uri) {
    if (uri == null || !mounted) return;
    if (uri.scheme != 'ssmartpos' || uri.host != 'quick-entry') return;
    final action = uri.queryParameters['action'];
    // avoid stacking duplicates
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => QuickEntryScreen(initialAction: action),
      ),
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
