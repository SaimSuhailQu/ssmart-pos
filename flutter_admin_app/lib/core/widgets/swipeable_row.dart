import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// One revealed action behind a [SwipeableRow].
class SwipeAction {
  final IconData icon;
  final String label;
  final Color color;
  final FutureOr<void> Function() onTap;

  const SwipeAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
}

/// iOS-style swipe-to-reveal row actions.
///
/// Drag the row left to reveal [actions] (Edit / Delete …). Release past
/// ~40% of the revealed width (or fling) to snap open, otherwise it springs
/// shut. Tapping an action runs it and closes the row; tapping the row
/// while open just closes it.
///
/// Example:
/// ```dart
/// SwipeableRow(
///   actions: [
///     SwipeAction(
///       icon: CupertinoIcons.pencil,
///       label: 'Edit',
///       color: AppTheme.actionBlue,
///       onTap: () => _editExpense(expense),
///     ),
///     SwipeAction(
///       icon: CupertinoIcons.delete,
///       label: 'Delete',
///       color: AppTheme.errorRed,
///       onTap: () => _confirmDeleteExpense(context, expense),
///     ),
///   ],
///   child: _ExpenseCard(expense: expense),
/// )
/// ```
class SwipeableRow extends StatefulWidget {
  final Widget child;
  final List<SwipeAction> actions;
  final double actionExtent;
  final double borderRadius;

  const SwipeableRow({
    super.key,
    required this.child,
    required this.actions,
    this.actionExtent = 76,
    this.borderRadius = 12,
  }) : assert(actions.length > 0, 'SwipeableRow needs at least one action');

  @override
  State<SwipeableRow> createState() => _SwipeableRowState();
}

class _SwipeableRowState extends State<SwipeableRow>
    with SingleTickerProviderStateMixin {
  double _offset = 0;
  late final AnimationController _snap;
  late Animation<double> _snapAnim;

  double get _maxReveal => widget.actions.length * widget.actionExtent;
  bool get _isOpen => _offset > _maxReveal * 0.5;

  @override
  void initState() {
    super.initState();
    _snap = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _snapAnim = Tween<double>(begin: 0, end: 0).animate(_snap);
    _snap.addListener(() {
      if (mounted) setState(() => _offset = _snapAnim.value);
    });
  }

  @override
  void dispose() {
    _snap.dispose();
    super.dispose();
  }

  void _animateTo(double target) {
    _snap.stop();
    _snapAnim = Tween<double>(begin: _offset, end: target).animate(
      CurvedAnimation(parent: _snap, curve: Curves.easeOutCubic),
    );
    _snap.forward(from: 0);
  }

  void _close() => _animateTo(0);

  void _onDragUpdate(DragUpdateDetails details) {
    _snap.stop();
    setState(() {
      _offset = (_offset - details.delta.dx).clamp(0.0, _maxReveal);
    });
  }

  void _onDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (_offset > _maxReveal * 0.4 || velocity < -600) {
      Haptics.tap();
      _animateTo(_maxReveal);
    } else {
      _animateTo(0);
    }
  }

  Future<void> _onActionTap(SwipeAction action) async {
    await Haptics.tap();
    _close();
    await action.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Revealed actions, pinned right — full-bleed like iOS Mail, no gaps.
        Positioned.fill(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: widget.actions
                  .map(
                    (action) => SizedBox(
                      width: widget.actionExtent,
                      height: double.infinity,
                      child: Material(
                        color: action.color,
                        child: InkWell(
                          onTap: () => _onActionTap(action),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(action.icon, color: Colors.white, size: 22),
                              const SizedBox(height: 4),
                              Text(
                                action.label,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        // The row itself, sliding over the actions.
        GestureDetector(
          behavior: HitTestBehavior.translucent,
          onHorizontalDragUpdate: _onDragUpdate,
          onHorizontalDragEnd: _onDragEnd,
          onHorizontalDragCancel: () => _animateTo(0),
          onTap: _isOpen ? _close : null,
          child: Transform.translate(
            offset: Offset(-_offset, 0),
            child: IgnorePointer(
              ignoring: _isOpen,
              child: widget.child,
            ),
          ),
        ),
      ],
    );
  }
}
