import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:intl/intl.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// Admin screen for managing device licenses from the mobile app.
///
/// Provides:
///  - List of all licensed devices with status, customer name, and expiry
///  - Activate a new device by entering / scanning the device code
///  - Deactivate (revoke) a device
///  - Extend a subscription
///
/// All changes are written directly to `licenses/<fingerprint>` in the
/// Firebase RTDB, which the desktop and mobile license gates read on startup
/// and during background revalidation.
class LicenseManagerScreen extends StatefulWidget {
  const LicenseManagerScreen({super.key});

  @override
  State<LicenseManagerScreen> createState() => _LicenseManagerScreenState();
}

class _LicenseManagerScreenState extends State<LicenseManagerScreen> {
  final _db = FirebaseDatabase.instance;
  Map<String, dynamic> _licenses = {};
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadLicenses();
  }

  Future<void> _loadLicenses() async {
    setState(() => _loading = true);
    try {
      final snap = await _db.ref('licenses').get();
      if (snap.exists && snap.value != null) {
        final raw = Map<String, dynamic>.from(snap.value as Map);
        setState(() {
          _licenses = raw;
          _loading = false;
        });
      } else {
        setState(() {
          _licenses = {};
          _loading = false;
        });
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load licenses: $e')),
        );
      }
    }
  }

  // ---- Activate a new device ---- //

  void _showActivateDialog() {
    final codeCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final keyCtrl = TextEditingController();
    String? expiresAt;
    String selectedRole = 'tenant';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 16,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppTheme.borderColor,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    Text(
                      'Activate License',
                      style: AppTheme.titleLarge
                          .copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Enter the device code sent by the buyer to activate their license.',
                      style: AppTheme.bodySmall,
                    ),
                    const SizedBox(height: 20),

                    // Device code
                    TextField(
                      controller: codeCtrl,
                      style: AppTheme.bodyMedium.copyWith(
                        fontFamily: 'monospace',
                        fontSize: 13,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Device Code *',
                        labelStyle: AppTheme.labelMedium,
                        hintText: 'Paste the SHA-256 device fingerprint',
                        hintStyle: AppTheme.bodySmall,
                        suffixIcon: IconButton(
                          icon: const Icon(
                            CupertinoIcons.doc_on_clipboard,
                            size: 18,
                          ),
                          onPressed: () async {
                            final data =
                                await Clipboard.getData(Clipboard.kTextPlain);
                            if (data?.text != null) {
                              codeCtrl.text = data!.text!.trim();
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Customer name
                    TextField(
                      controller: nameCtrl,
                      style: AppTheme.bodyMedium,
                      decoration: InputDecoration(
                        labelText: 'Customer Name',
                        labelStyle: AppTheme.labelMedium,
                        hintText: 'e.g. Ali Mart, Rawalpindi',
                        hintStyle: AppTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // License key
                    TextField(
                      controller: keyCtrl,
                      style: AppTheme.bodyMedium,
                      decoration: InputDecoration(
                        labelText: 'License Key',
                        labelStyle: AppTheme.labelMedium,
                        hintText: 'e.g. SSM-XXXX-XXXX',
                        hintStyle: AppTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Role selector
                    Row(
                      children: [
                        Text('Role:', style: AppTheme.labelMedium),
                        const SizedBox(width: 12),
                        ChoiceChip(
                          label: const Text('Tenant'),
                          selected: selectedRole == 'tenant',
                          onSelected: (_) {
                            setDialogState(() => selectedRole = 'tenant');
                          },
                          selectedColor:
                              AppTheme.primaryCyan.withValues(alpha: 0.25),
                        ),
                        const SizedBox(width: 8),
                        ChoiceChip(
                          label: const Text('Master'),
                          selected: selectedRole == 'master',
                          onSelected: (_) {
                            setDialogState(() => selectedRole = 'master');
                          },
                          selectedColor:
                              AppTheme.successGreen.withValues(alpha: 0.25),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Expiry date
                    GestureDetector(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate:
                              DateTime.now().add(const Duration(days: 365)),
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 3650)),
                        );
                        if (picked != null) {
                          setDialogState(() {
                            expiresAt = picked.toIso8601String().split('T')[0];
                          });
                        }
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.cardBackground,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                expiresAt ?? 'Expiry Date (optional — tap to set)',
                                style: AppTheme.bodyMedium.copyWith(
                                  color: expiresAt != null
                                      ? AppTheme.textPrimary
                                      : AppTheme.textSecondary,
                                ),
                              ),
                            ),
                            const Icon(
                              CupertinoIcons.calendar,
                              size: 16,
                              color: AppTheme.textSecondary,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Activate button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => _activateLicense(
                          ctx,
                          code: codeCtrl.text.trim(),
                          customerName: nameCtrl.text.trim(),
                          licenseKey: keyCtrl.text.trim(),
                          role: selectedRole,
                          expiresAt: expiresAt,
                        ),
                        icon: const Icon(
                          CupertinoIcons.checkmark_shield,
                          size: 16,
                        ),
                        label: Text(
                          'Activate License',
                          style: AppTheme.labelLarge
                              .copyWith(color: Colors.black),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.successGreen,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _activateLicense(
    BuildContext ctx, {
    required String code,
    required String customerName,
    required String licenseKey,
    required String role,
    String? expiresAt,
  }) async {
    if (code.isEmpty) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(content: Text('Device code is required')),
        );
      }
      return;
    }

    try {
      final record = <String, dynamic>{
        'active': true,
        'customerName':
            customerName.isNotEmpty ? customerName : 'Unnamed Device',
        'role': role,
        'activatedAt': DateTime.now().toIso8601String(),
        'activatedFrom': 'mobile_admin',
      };
      if (licenseKey.isNotEmpty) record['licenseKey'] = licenseKey;
      if (expiresAt != null) record['expiresAt'] = expiresAt;

      await _db.ref('licenses/$code').set(record);

      // Also set tenant_map entry for tenants
      if (role == 'tenant') {
        await _db.ref('tenant_map/$code').set({
          'tenant': 'store_${code.substring(0, 8)}',
          'role': 'tenant',
        });
      }

      if (ctx.mounted) Navigator.of(ctx).pop();
      _loadLicenses();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ License activated for $customerName'),
            backgroundColor: AppTheme.successGreen.withValues(alpha: 0.9),
          ),
        );
      }
    } catch (e) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('Failed to activate: $e')),
        );
      }
    }
  }

  // ---- Deactivate ---- //

  Future<void> _deactivateLicense(String fingerprint, String name) async {
    final confirm = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Deactivate License'),
        content: Text(
          'Are you sure you want to deactivate the license for "$name"? The device will lock within 12 hours.',
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(ctx, false),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Deactivate'),
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _db.ref('licenses/$fingerprint').update({
        'active': false,
        'deactivated': true,
        'deactivatedAt': DateTime.now().toIso8601String(),
      });
      _loadLicenses();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('🚫 License deactivated for $name'),
            backgroundColor: AppTheme.errorRed.withValues(alpha: 0.9),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  // ---- Reactivate ---- //

  Future<void> _reactivateLicense(String fingerprint, String name) async {
    try {
      await _db.ref('licenses/$fingerprint').update({
        'active': true,
        'deactivated': false,
        'revoked': false,
        'reactivatedAt': DateTime.now().toIso8601String(),
      });
      _loadLicenses();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ License reactivated for $name'),
            backgroundColor: AppTheme.successGreen.withValues(alpha: 0.9),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  // ---- Extend ---- //

  Future<void> _extendLicense(String fingerprint, String name) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 365)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (picked == null) return;

    try {
      await _db.ref('licenses/$fingerprint').update({
        'expiresAt': picked.toIso8601String().split('T')[0],
        'active': true,
        'deactivated': false,
      });
      _loadLicenses();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '📅 License for $name extended to ${DateFormat('dd MMM yyyy').format(picked)}',
            ),
            backgroundColor: AppTheme.primaryCyan.withValues(alpha: 0.9),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  // ---- Delete ---- //

  Future<void> _deleteLicense(String fingerprint, String name) async {
    final confirm = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: const Text('Delete License'),
        content: Text(
          'Permanently delete the license record for "$name"? This cannot be undone.',
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(ctx, false),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Delete'),
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _db.ref('licenses/$fingerprint').remove();
      await _db.ref('tenant_map/$fingerprint').remove();
      _loadLicenses();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredEntries = _licenses.entries.where((e) {
      if (_search.isEmpty) return true;
      final val = e.value is Map ? Map<String, dynamic>.from(e.value) : <String, dynamic>{};
      final name = (val['customerName'] ?? '').toString().toLowerCase();
      final fp = e.key.toLowerCase();
      return name.contains(_search.toLowerCase()) ||
          fp.contains(_search.toLowerCase());
    }).toList();

    // Sort: active first, then by customerName
    filteredEntries.sort((a, b) {
      final aVal = a.value is Map ? Map<String, dynamic>.from(a.value) : <String, dynamic>{};
      final bVal = b.value is Map ? Map<String, dynamic>.from(b.value) : <String, dynamic>{};
      final aActive = aVal['active'] == true && aVal['deactivated'] != true;
      final bActive = bVal['active'] == true && bVal['deactivated'] != true;
      if (aActive != bActive) return aActive ? -1 : 1;
      return (aVal['customerName'] ?? '')
          .toString()
          .compareTo((bVal['customerName'] ?? '').toString());
    });

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'License Manager',
          style: AppTheme.titleLarge.copyWith(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.arrow_clockwise, size: 20),
            onPressed: _loadLicenses,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showActivateDialog,
        backgroundColor: AppTheme.successGreen,
        foregroundColor: Colors.black,
        icon: const Icon(CupertinoIcons.add, size: 18),
        label: Text(
          'Activate',
          style: AppTheme.labelLarge.copyWith(color: Colors.black),
        ),
      ),
      body: Column(
        children: [
          // Summary strip
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _StatChip(
                  label: 'Total',
                  value: _licenses.length.toString(),
                  color: AppTheme.primaryCyan,
                ),
                const SizedBox(width: 8),
                _StatChip(
                  label: 'Active',
                  value: _licenses.values
                      .where((v) {
                        if (v is! Map) return false;
                        return v['active'] == true && v['deactivated'] != true;
                      })
                      .length
                      .toString(),
                  color: AppTheme.successGreen,
                ),
                const SizedBox(width: 8),
                _StatChip(
                  label: 'Revoked',
                  value: _licenses.values
                      .where((v) {
                        if (v is! Map) return false;
                        return v['active'] == false ||
                            v['deactivated'] == true ||
                            v['revoked'] == true;
                      })
                      .length
                      .toString(),
                  color: AppTheme.errorRed,
                ),
              ],
            ),
          ),

          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              style: AppTheme.bodyMedium,
              decoration: InputDecoration(
                hintText: 'Search by name or device code…',
                hintStyle: AppTheme.bodySmall,
                prefixIcon: const Icon(CupertinoIcons.search, size: 18),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),
          ),
          const SizedBox(height: 8),

          // License list
          Expanded(
            child: _loading
                ? const Center(child: CupertinoActivityIndicator(radius: 16))
                : filteredEntries.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              CupertinoIcons.shield,
                              size: 48,
                              color: AppTheme.textTertiary,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _licenses.isEmpty
                                  ? 'No licenses yet'
                                  : 'No results for "$_search"',
                              style: AppTheme.bodySmall,
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadLicenses,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: filteredEntries.length,
                          itemBuilder: (ctx, i) {
                            final entry = filteredEntries[i];
                            final fp = entry.key;
                            final val = entry.value is Map
                                ? Map<String, dynamic>.from(entry.value)
                                : <String, dynamic>{};
                            return _LicenseCard(
                              fingerprint: fp,
                              data: val,
                              onDeactivate: () => _deactivateLicense(
                                fp,
                                val['customerName'] ?? fp,
                              ),
                              onReactivate: () => _reactivateLicense(
                                fp,
                                val['customerName'] ?? fp,
                              ),
                              onExtend: () =>
                                  _extendLicense(fp, val['customerName'] ?? fp),
                              onDelete: () =>
                                  _deleteLicense(fp, val['customerName'] ?? fp),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

// ---- Stat chip ---- //

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: AppTheme.titleMedium.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: AppTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

// ---- License card ---- //

class _LicenseCard extends StatelessWidget {
  final String fingerprint;
  final Map<String, dynamic> data;
  final VoidCallback onDeactivate;
  final VoidCallback onReactivate;
  final VoidCallback onExtend;
  final VoidCallback onDelete;

  const _LicenseCard({
    required this.fingerprint,
    required this.data,
    required this.onDeactivate,
    required this.onReactivate,
    required this.onExtend,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final active =
        data['active'] == true && data['deactivated'] != true && data['revoked'] != true;
    final name = data['customerName'] ?? 'Unnamed';
    final role = data['role'] ?? 'tenant';
    final licenseKey = data['licenseKey'];
    final expiresAt = data['expiresAt'];
    final fpShort = fingerprint.length > 20
        ? '${fingerprint.substring(0, 12)}…${fingerprint.substring(fingerprint.length - 6)}'
        : fingerprint;

    final isMaster = role == 'master';

    // Check if subscription has expired
    bool subscriptionExpired = false;
    if (expiresAt != null && active) {
      final exp = DateTime.tryParse(expiresAt.toString());
      if (exp != null && exp.isBefore(DateTime.now())) {
        subscriptionExpired = true;
      }
    }

    final statusColor = active && !subscriptionExpired
        ? AppTheme.successGreen
        : subscriptionExpired
            ? AppTheme.warningOrange
            : AppTheme.errorRed;
    final statusLabel = active && !subscriptionExpired
        ? (isMaster ? 'MASTER' : 'ACTIVE')
        : subscriptionExpired
            ? 'EXPIRED'
            : 'REVOKED';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.25),
          width: 0.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              // Status badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  name.toString(),
                  style: AppTheme.titleMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // Actions popup
              PopupMenuButton<String>(
                icon: const Icon(
                  CupertinoIcons.ellipsis,
                  size: 18,
                  color: AppTheme.textSecondary,
                ),
                color: AppTheme.surfaceDark,
                onSelected: (action) {
                  switch (action) {
                    case 'deactivate':
                      onDeactivate();
                    case 'reactivate':
                      onReactivate();
                    case 'extend':
                      onExtend();
                    case 'delete':
                      onDelete();
                    case 'copy':
                      Clipboard.setData(ClipboardData(text: fingerprint));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Device code copied')),
                      );
                  }
                },
                itemBuilder: (_) => [
                  if (active)
                    const PopupMenuItem(
                      value: 'deactivate',
                      child: Row(
                        children: [
                          Icon(
                            CupertinoIcons.xmark_shield,
                            size: 16,
                            color: AppTheme.errorRed,
                          ),
                          SizedBox(width: 8),
                          Text('Deactivate'),
                        ],
                      ),
                    ),
                  if (!active)
                    const PopupMenuItem(
                      value: 'reactivate',
                      child: Row(
                        children: [
                          Icon(
                            CupertinoIcons.checkmark_shield,
                            size: 16,
                            color: AppTheme.successGreen,
                          ),
                          SizedBox(width: 8),
                          Text('Reactivate'),
                        ],
                      ),
                    ),
                  const PopupMenuItem(
                    value: 'extend',
                    child: Row(
                      children: [
                        Icon(
                          CupertinoIcons.calendar,
                          size: 16,
                          color: AppTheme.primaryCyan,
                        ),
                        SizedBox(width: 8),
                        Text('Extend / Set Expiry'),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'copy',
                    child: Row(
                      children: [
                        Icon(
                          CupertinoIcons.doc_on_doc,
                          size: 16,
                          color: AppTheme.textSecondary,
                        ),
                        SizedBox(width: 8),
                        Text('Copy Device Code'),
                      ],
                    ),
                  ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(
                          CupertinoIcons.trash,
                          size: 16,
                          color: AppTheme.errorRed,
                        ),
                        SizedBox(width: 8),
                        Text('Delete'),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Details row
          Row(
            children: [
              const Icon(
                CupertinoIcons.device_phone_portrait,
                size: 12,
                color: AppTheme.textTertiary,
              ),
              const SizedBox(width: 4),
              Text(
                fpShort,
                style: AppTheme.labelSmall.copyWith(
                  fontFamily: 'monospace',
                  fontSize: 10,
                ),
              ),
              if (licenseKey != null) ...[
                const SizedBox(width: 12),
                const Icon(
                  CupertinoIcons.tag,
                  size: 12,
                  color: AppTheme.textTertiary,
                ),
                const SizedBox(width: 4),
                Text(
                  licenseKey.toString(),
                  style: AppTheme.labelSmall.copyWith(fontSize: 10),
                ),
              ],
            ],
          ),
          if (expiresAt != null) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  CupertinoIcons.clock,
                  size: 12,
                  color: subscriptionExpired
                      ? AppTheme.warningOrange
                      : AppTheme.textTertiary,
                ),
                const SizedBox(width: 4),
                Text(
                  'Expires: $expiresAt',
                  style: AppTheme.labelSmall.copyWith(
                    fontSize: 10,
                    color: subscriptionExpired
                        ? AppTheme.warningOrange
                        : AppTheme.textTertiary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
