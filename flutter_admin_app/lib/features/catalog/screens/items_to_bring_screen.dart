import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
import 'package:ssmart_pos_admin/core/widgets/graphite_empty_state.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/models/item_to_bring.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

/// Screen for tracking items to bring/purchase for the store
/// Shows unbrought items with live status banner and allows instant checking off.
class ItemsToBringScreen extends StatefulWidget {
  const ItemsToBringScreen({super.key});

  @override
  State<ItemsToBringScreen> createState() => _ItemsToBringScreenState();
}

class _ItemsToBringScreenState extends State<ItemsToBringScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _showBroughtOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showAddOrEditDialog(BuildContext context, [ItemToBring? existing]) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final qtyCtrl = TextEditingController(text: existing?.quantity ?? '');
    final noteCtrl = TextEditingController(text: existing?.note ?? '');
    final isEditing = existing != null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          top: 20,
          left: 20,
          right: 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isEditing ? 'Edit Item to Bring' : 'Add Item to Bring',
                    style: GraphiteTheme.screenTitle.copyWith(fontSize: 18),
                  ),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark_circle_fill, color: GraphiteTheme.slate),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: Colors.white, fontSize: 15),
                decoration: InputDecoration(
                  labelText: 'Item Name *',
                  hintText: 'e.g. Milk Pack 1L, Cooking Oil, Sugar 50kg',
                  prefixIcon: const Icon(CupertinoIcons.cart_badge_plus, color: GraphiteTheme.platinum),
                  filled: true,
                  fillColor: GraphiteTheme.cardSurface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: GraphiteTheme.cardBorder),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 15),
                decoration: InputDecoration(
                  labelText: 'Quantity / Units (Optional)',
                  hintText: 'e.g. 2 Cartons, 10 Pcs, 5 Kg',
                  prefixIcon: const Icon(CupertinoIcons.number, color: GraphiteTheme.slate),
                  filled: true,
                  fillColor: GraphiteTheme.cardSurface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: GraphiteTheme.cardBorder),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Special Note / Brand (Optional)',
                  hintText: 'e.g. Bring from Metro or check wholesale price',
                  prefixIcon: const Icon(CupertinoIcons.text_quote, color: GraphiteTheme.slate),
                  filled: true,
                  fillColor: GraphiteTheme.cardSurface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: GraphiteTheme.cardBorder),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GraphiteTheme.platinum,
                    foregroundColor: GraphiteTheme.graphiteDeep,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(CupertinoIcons.checkmark_alt_circle_fill),
                  label: Text(
                    isEditing ? 'Save Changes' : 'Add to Bring List',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter an item name')),
                      );
                      return;
                    }
                    Navigator.pop(ctx);
                    await Haptics.success();
                    if (!context.mounted) return;
                    await context.read<FirebaseService>().saveItemToBring(
                      id: existing?.id,
                      name: name,
                      quantity: qtyCtrl.text.trim(),
                      note: noteCtrl.text.trim(),
                    );
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('"$name" added to bring list!'),
                        backgroundColor: GraphiteTheme.graphiteCard,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, ItemToBring item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Item?', style: TextStyle(color: Colors.white)),
        content: Text('Remove "${item.name}" from the bring list?', style: const TextStyle(color: GraphiteTheme.slate)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: GraphiteTheme.slate)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: GraphiteTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await Haptics.heavy();
              if (!context.mounted) return;
              await context.read<FirebaseService>().deleteItemToBring(item.id);
            },
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: GraphiteTheme.screenBase,
      appBar: AppBar(
        backgroundColor: GraphiteTheme.screenBase,
        title: const Text('Items to Bring', style: TextStyle(fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: GraphiteTheme.platinum),
            tooltip: 'Add Item to Bring',
            onPressed: () => _showAddOrEditDialog(context),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: GraphiteTheme.platinum,
        foregroundColor: GraphiteTheme.graphiteDeep,
        icon: const Icon(CupertinoIcons.plus, size: 20),
        label: const Text('Add Item', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        onPressed: () => _showAddOrEditDialog(context),
      ),
      body: StreamBuilder<List<ItemToBring>>(
        stream: firebaseService.getItemsToBringStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return const AppLoadingIndicator(message: 'Loading items to bring...');
          }

          final allItems = snapshot.data ?? [];
          final pendingItems = allItems.where((i) => !i.isBrought).toList();
          final broughtItems = allItems.where((i) => i.isBrought).toList();

          final q = _searchQuery.trim().toLowerCase();
          final displayList = (_showBroughtOnly ? broughtItems : pendingItems).where((i) {
            if (q.isEmpty) return true;
            return i.name.toLowerCase().contains(q) ||
                i.quantity.toLowerCase().contains(q) ||
                i.note.toLowerCase().contains(q);
          }).toList();

          return Column(
            children: [
              // LIVE NOTIFICATION / PINNED STATUS BANNER
              _buildLiveNotificationBanner(pendingItems.length),

              // Filter & Search Header
              Container(
                color: GraphiteTheme.graphiteDeep,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Column(
                  children: [
                    TextField(
                      controller: _searchController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search items to bring...',
                        hintStyle: const TextStyle(color: GraphiteTheme.slateDim, fontSize: 13),
                        prefixIcon: const Icon(CupertinoIcons.search, color: GraphiteTheme.slate, size: 18),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(CupertinoIcons.xmark_circle_fill, color: GraphiteTheme.slate, size: 16),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: GraphiteTheme.cardSurface,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: GraphiteTheme.cardBorder),
                        ),
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val),
                    ),
                    const SizedBox(height: 8),

                    // Segmented Tabs: "To Bring (Pending)" vs "Already Brought"
                    Row(
                      children: [
                        _filterTab(
                          label: 'To Bring (${pendingItems.length})',
                          isSelected: !_showBroughtOnly,
                          onTap: () => setState(() => _showBroughtOnly = false),
                        ),
                        const SizedBox(width: 8),
                        _filterTab(
                          label: 'Brought (${broughtItems.length})',
                          isSelected: _showBroughtOnly,
                          onTap: () => setState(() => _showBroughtOnly = true),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Items List or Empty State
              Expanded(
                child: displayList.isEmpty
                    ? _buildEmptyState(_showBroughtOnly, pendingItems.length)
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                        itemCount: displayList.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final item = displayList[index];
                          return _ItemToBringCard(
                            item: item,
                            onToggle: (val) async {
                              await Haptics.tap();
                              await firebaseService.toggleItemBrought(item.id, val);
                            },
                            onEdit: () => _showAddOrEditDialog(context, item),
                            onDelete: () => _confirmDelete(context, item),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Pinned top notification banner simulating a persistent notification panel
  Widget _buildLiveNotificationBanner(int pendingCount) {
    if (pendingCount == 0) {
      return Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
        ),
        child: const Row(
          children: [
            Icon(CupertinoIcons.checkmark_seal_fill, color: Color(0xFF10B981), size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'All items brought! Nothing pending on your store shopping list.',
                style: TextStyle(color: Color(0xFF10B981), fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
              shape: BoxShape.circle,
            ),
            child: const Icon(CupertinoIcons.bell_fill, color: Color(0xFFF59E0B), size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Text(
                      'LIVE NOTIFICATION',
                      style: TextStyle(
                        color: Color(0xFFF59E0B),
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF59E0B),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '$pendingCount ${pendingCount == 1 ? 'item' : 'items'} need to be brought to the store.',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$pendingCount PENDING',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterTab({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () async {
        await Haptics.tap();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? GraphiteTheme.platinum : GraphiteTheme.cardSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? GraphiteTheme.platinum : GraphiteTheme.cardBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? GraphiteTheme.graphiteDeep : GraphiteTheme.slate,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool broughtOnly, int pendingCount) {
    if (broughtOnly) {
      return const GraphiteEmptyState(
        icon: CupertinoIcons.checkmark_circle,
        title: 'No Brought Items Yet',
        message: 'Items marked as brought will appear here as your completed history.',
        iconColor: GraphiteTheme.slate,
      );
    }
    return GraphiteEmptyState(
      icon: CupertinoIcons.cart_badge_plus,
      title: 'No Items to Bring',
      message: 'Write down which inventory items or supplies you need to buy for the shop.',
      actionLabel: 'Add First Item',
      actionIcon: CupertinoIcons.plus,
      onAction: () => _showAddOrEditDialog(context),
      iconColor: GraphiteTheme.platinum,
    );
  }
}

/// Item card tile with checkbox and edit/delete actions
class _ItemToBringCard extends StatelessWidget {
  final ItemToBring item;
  final ValueChanged<bool> onToggle;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _ItemToBringCard({
    required this.item,
    required this.onToggle,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isBrought = item.isBrought;

    return Container(
      decoration: BoxDecoration(
        color: isBrought ? GraphiteTheme.cardSurface.withValues(alpha: 0.03) : GraphiteTheme.cardSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isBrought ? GraphiteTheme.cardBorder.withValues(alpha: 0.05) : GraphiteTheme.cardBorder,
        ),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Checkbox toggle
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: GestureDetector(
              onTap: () => onToggle(!isBrought),
              child: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isBrought ? const Color(0xFF10B981) : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: isBrought ? const Color(0xFF10B981) : GraphiteTheme.slate,
                    width: 1.5,
                  ),
                ),
                child: isBrought
                    ? const Icon(CupertinoIcons.checkmark, size: 16, color: Colors.black)
                    : null,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Title, quantity & note
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: TextStyle(
                          color: isBrought ? GraphiteTheme.slateDim : Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          decoration: isBrought ? TextDecoration.lineThrough : null,
                        ),
                      ),
                    ),
                    if (item.quantity.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isBrought
                              ? GraphiteTheme.cardSurface
                              : GraphiteTheme.platinum.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isBrought ? GraphiteTheme.cardBorder : GraphiteTheme.platinumBorder,
                          ),
                        ),
                        child: Text(
                          item.quantity,
                          style: TextStyle(
                            color: isBrought ? GraphiteTheme.slateDim : GraphiteTheme.platinumLight,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (item.note.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.note,
                    style: TextStyle(
                      color: isBrought ? GraphiteTheme.slateDim : GraphiteTheme.slate,
                      fontSize: 12.5,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Actions popup / edit / delete
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(CupertinoIcons.pencil, size: 16, color: GraphiteTheme.slate),
                onPressed: onEdit,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 12),
              IconButton(
                icon: const Icon(CupertinoIcons.trash, size: 16, color: GraphiteTheme.errorRed),
                onPressed: onDelete,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
