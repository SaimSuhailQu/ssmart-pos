import 'package:url_launcher/url_launcher.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';

/// Helper utility for opening WhatsApp app directly on iOS/Android
/// with pre-formatted receipts, reminders, and payment ledgers
class WhatsAppHelper {
  /// Clean and format Pakistani / International numbers to standard format (e.g. 923001234567)
  static String formatPhoneNumber(String phone) {
    var clean = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.startsWith('0')) {
      clean = '92${clean.substring(1)}';
    } else if (clean.length == 10) {
      clean = '92$clean';
    }
    return clean;
  }

  /// Open WhatsApp chat directly with a pre-filled message
  static Future<bool> openWhatsApp({
    required String phone,
    required String message,
  }) async {
    final cleanPhone = formatPhoneNumber(phone);
    if (cleanPhone.isEmpty) return false;

    final encodedMsg = Uri.encodeComponent(message);

    // Try direct native whatsapp:// deep link first
    final nativeUri = Uri.parse('whatsapp://send?phone=$cleanPhone&text=$encodedMsg');
    final webUri = Uri.parse('https://wa.me/$cleanPhone?text=$encodedMsg');

    try {
      if (await canLaunchUrl(nativeUri)) {
        return await launchUrl(nativeUri, mode: LaunchMode.externalApplication);
      } else {
        return await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      // Fallback to web link
      try {
        return await launchUrl(webUri, mode: LaunchMode.externalApplication);
      } catch (_) {
        return false;
      }
    }
  }

  /// Generate & Send Customer Udhaar / Khata Reminder
  static Future<bool> sendCustomerKhataReminder({
    required CustomerModel customer,
  }) async {
    final message = '''
🏪 *SS MART & GENERAL STORE*
━━━━━━━━━━━━━━━━━━━━━
Assalam-o-Alaikum *${customer.name}* sahab,

Yeh aapke SSmart account ka summary balance reminder hai:

💰 *Total Udhaar (Loan Due): PKR ${customer.balance.toStringAsFixed(0)}*
⭐ *Loyalty Points:* ${customer.points}

Baraye meherbani apna baqaya jaat jald az jald clear karwayen. Shukriya!
━━━━━━━━━━━━━━━━━━━━━
_SSmart POS Automation_''';

    return openWhatsApp(phone: customer.phone, message: message);
  }

  /// Generate & Send Khata Transaction (Payment / Loan) Notification
  static Future<bool> sendKhataReceipt({
    required String customerName,
    required String phone,
    required double amount,
    required String type, // 'PAYMENT' or 'LOAN'
    required double newBalance,
  }) async {
    final isPayment = type == 'PAYMENT';
    final actionText = isPayment ? '✅ PAYMENT RECEIVED (Wasool Hua)' : '⚠️ UDHAAR ENTRY (Loan Given)';

    final message = '''
🏪 *SS MART & GENERAL STORE*
━━━━━━━━━━━━━━━━━━━━━
*Customer:* ${customerName}
*Transaction:* ${actionText}
*Amount:* PKR ${amount.toStringAsFixed(0)}
💰 *Updated Balance Due: PKR ${newBalance.toStringAsFixed(0)}*
📅 *Date:* ${DateTime.now().toString().substring(0, 16)}
━━━━━━━━━━━━━━━━━━━━━
Shukriya! SSmart POS System.''';

    return openWhatsApp(phone: phone, message: message);
  }

  /// Generate & Send Sale Invoice Receipt to Customer
  static Future<bool> sendSaleReceipt({
    required Sale sale,
    required String phone,
  }) async {
    final itemsList = sale.items?.map((item) => '• ${item.productName} (${item.quantity}x @ ${item.price.toStringAsFixed(0)}) = PKR ${(item.total).toStringAsFixed(0)}').join('\n') ?? '';

    final message = '''
🏪 *SS MART - DIGITAL RECEIPT*
━━━━━━━━━━━━━━━━━━━━━
*Bill #:* ${sale.id}
*Date:* ${sale.timestamp.substring(0, 16)}
*Payment:* ${sale.paymentMethod}

*Items Purchased:*
$itemsList

━━━━━━━━━━━━━━━━━━━━━
*Subtotal:* PKR ${sale.subtotal.toStringAsFixed(0)}
${sale.discount > 0 ? '*Discount:* -PKR ${sale.discount.toStringAsFixed(0)}\n' : ''}*TOTAL BILL:* *PKR ${sale.total.toStringAsFixed(0)}*
━━━━━━━━━━━━━━━━━━━━━
Thank you for shopping at SS Mart! 🙏''';

    return openWhatsApp(phone: phone, message: message);
  }

  /// Generate & Send Vendor Purchase Order / Payment Notification
  static Future<bool> sendVendorPO({
    required PurchaseOrderModel po,
  }) async {
    final message = '''
🏪 *SS MART - VENDOR PURCHASE ORDER*
━━━━━━━━━━━━━━━━━━━━━
*Vendor:* ${po.vendorName}
*Contact:* ${po.contactPerson}

*Total Billed:* PKR ${po.totalCost.toStringAsFixed(0)}
*Amount Paid:* PKR ${po.paidAmount.toStringAsFixed(0)}
*Balance Due:* PKR ${po.balanceDue.toStringAsFixed(0)}
*Status:* ${po.status} / ${po.paymentStatus}
${po.notes.isNotEmpty ? '*Notes:* ${po.notes}\n' : ''}
━━━━━━━━━━━━━━━━━━━━━
_SSmart POS Vendor Management_''';

    return openWhatsApp(phone: po.phone, message: message);
  }
}
