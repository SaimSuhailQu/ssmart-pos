package com.ssmartpos

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Android USB host transport for ESC/POS thermal receipt printers.
 *
 * This is the same mechanism PrintShare uses: enumerate devices with
 * [UsbManager], ask Android for per-device permission with the system
 * dialog, then write raw ESC/POS bytes to the printer-class bulk OUT
 * endpoint. No driver, no vendor SDK, no Bluetooth.
 *
 * Contract with the Dart side (`UsbPrinterChannel`):
 * - `listDevices` -> List<Map> of {name, deviceName, vendorId,
 *   productId, manufacturerName, productName}. Needs no permission.
 * - `printBytes` {vendorId, productId, deviceName, bytes} -> success
 *   or error with one of: no_device, permission_denied,
 *   permission_timeout, no_interface, no_endpoint, open_failed,
 *   write_failed, busy.
 *
 * USB I/O runs on a background thread; results are always posted
 * back on the main thread. At most one print runs at a time.
 */
class UsbPrinterPlugin(
    context: Context,
    messenger: BinaryMessenger,
) : MethodChannel.MethodCallHandler {

    companion object {
        private const val CHANNEL = "com.ssmartpos/usb_printer"
        private const val ACTION_USB_PERMISSION = "com.ssmartpos.USB_PERMISSION"
        private const val PERMISSION_TIMEOUT_SECONDS = 60L
        private const val WRITE_TIMEOUT_MS = 5000
        private const val CHUNK_SIZE = 16384
    }

    private val appContext: Context = context.applicationContext
    private val usbManager: UsbManager =
        appContext.getSystemService(Context.USB_SERVICE) as UsbManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val printInFlight = AtomicBoolean(false)
    private val requestCodeCounter = AtomicInteger(0)

    init {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler(this)
    }

    private class PrintFailure(val code: String, message: String) : Exception(message)

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "listDevices" -> result.success(listDevices())
            "printBytes" -> {
                if (!printInFlight.compareAndSet(false, true)) {
                    result.error("busy", "A print is already in progress.", null)
                    return
                }
                Thread { runPrint(call, result) }.start()
            }
            else -> result.notImplemented()
        }
    }

    // ------------------------------------------------------------------
    // Discovery
    // ------------------------------------------------------------------

    private fun listDevices(): List<Map<String, Any?>> {
        val devices = usbManager.deviceList.values.toList()
        return devices
            .sortedWith(
                compareByDescending<UsbDevice> { hasPrinterInterface(it) }
                    .thenBy { it.productName ?: it.deviceName },
            )
            .map { device ->
                mapOf<String, Any?>(
                    "name" to (device.productName ?: device.deviceName),
                    "deviceName" to device.deviceName,
                    "vendorId" to device.vendorId,
                    "productId" to device.productId,
                    "manufacturerName" to device.manufacturerName,
                    "productName" to device.productName,
                )
            }
    }

    private fun hasPrinterInterface(device: UsbDevice): Boolean {
        for (i in 0 until device.interfaceCount) {
            if (device.getInterface(i).interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
                return true
            }
        }
        return false
    }

    // ------------------------------------------------------------------
    // Printing
    // ------------------------------------------------------------------

    private fun runPrint(call: MethodCall, result: MethodChannel.Result) {
        try {
            val vendorId = call.argument<Number>("vendorId")?.toInt()
                ?: throw PrintFailure("no_device", "Missing vendorId.")
            val productId = call.argument<Number>("productId")?.toInt()
                ?: throw PrintFailure("no_device", "Missing productId.")
            val deviceName = call.argument<String>("deviceName").orEmpty()
            val bytes = call.argument<ByteArray>("bytes")
                ?: throw PrintFailure("write_failed", "No bytes to print.")

            val device = findDevice(vendorId, productId, deviceName)
                ?: throw PrintFailure("no_device", "Printer is not attached.")

            if (!usbManager.hasPermission(device)) {
                val granted = requestPermission(device)
                if (!granted) {
                    throw PrintFailure(
                        "permission_denied",
                        "The user denied USB permission for this printer.",
                    )
                }
            }

            writeBytes(device, bytes)
            postSuccess(result)
        } catch (e: PrintFailure) {
            postError(result, e.code, e.message)
        } catch (e: Exception) {
            postError(result, "write_failed", e.message ?: "Unexpected USB error.")
        } finally {
            printInFlight.set(false)
        }
    }

    private fun findDevice(vendorId: Int, productId: Int, deviceName: String): UsbDevice? {
        val matches = usbManager.deviceList.values.filter {
            it.vendorId == vendorId && it.productId == productId
        }
        if (matches.isEmpty()) return null
        if (deviceName.isNotEmpty()) {
            matches.firstOrNull { it.deviceName == deviceName }?.let { return it }
        }
        return matches.first()
    }

    /**
     * Asks Android for permission and blocks (background thread only)
     * until the user answers the dialog, or the timeout elapses.
     * Returns true only when permission was granted for [device].
     * Throws [PrintFailure] with `permission_timeout` on no answer.
     */
    @Suppress("UnspecifiedRegisterReceiverFlag")
    private fun requestPermission(device: UsbDevice): Boolean {
        val latch = CountDownLatch(1)
        val grantedRef = AtomicReference<Boolean?>(null)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != ACTION_USB_PERMISSION) return
                val granted =
                    intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                val extraDevice = extraDevice(intent)
                // Ignore answers for other devices (two identical
                // printers, stale intents from a previous process).
                if (extraDevice != null && extraDevice.deviceName != device.deviceName) return
                grantedRef.set(granted)
                latch.countDown()
            }
        }

        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            appContext.registerReceiver(receiver, filter)
        }

        try {
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            // A fresh request code per call: a reused PendingIntent can
            // redeliver a stale grant/deny from a previous process.
            val pendingIntent = PendingIntent.getBroadcast(
                appContext,
                requestCodeCounter.incrementAndGet(),
                Intent(ACTION_USB_PERMISSION),
                flags,
            )
            usbManager.requestPermission(device, pendingIntent)

            val answered = latch.await(PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            if (!answered) {
                throw PrintFailure(
                    "permission_timeout",
                    "No answer to the USB permission dialog.",
                )
            }
            return grantedRef.get() == true
        } finally {
            try {
                appContext.unregisterReceiver(receiver)
            } catch (_: IllegalArgumentException) {
                // Already unregistered; nothing to do.
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun extraDevice(intent: Intent): UsbDevice? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE) as? UsbDevice
        }
    }

    private fun writeBytes(device: UsbDevice, bytes: ByteArray) {
        val connection = usbManager.openDevice(device)
            ?: throw PrintFailure("open_failed", "Could not open the USB device.")

        // Prefer the USB printer-class interface (7/1/2); fall back to
        // the first interface with a bulk OUT endpoint; last resort is
        // the first interface at all (some cheap printers are
        // vendor-class 0xFF yet still speak ESC/POS over bulk).
        var chosenInterface: android.hardware.usb.UsbInterface? = null
        var chosenEndpoint: android.hardware.usb.UsbEndpoint? = null

        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            val endpoint = bulkOutEndpoint(iface)
            if (iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER && endpoint != null) {
                chosenInterface = iface
                chosenEndpoint = endpoint
                break
            }
            if (chosenInterface == null && endpoint != null) {
                chosenInterface = iface
                chosenEndpoint = endpoint
            }
        }
        if (chosenInterface == null && device.interfaceCount > 0) {
            chosenInterface = device.getInterface(0)
        }

        val iface = chosenInterface
            ?: throw PrintFailure("no_interface", "Device has no USB interfaces.")
        try {
            if (!connection.claimInterface(iface, true)) {
                throw PrintFailure("open_failed", "Could not claim the printer interface.")
            }
            val endpoint = chosenEndpoint ?: bulkOutEndpoint(iface)
                ?: throw PrintFailure("no_endpoint", "No bulk OUT endpoint on the printer.")

            var offset = 0
            while (offset < bytes.size) {
                val len = minOf(CHUNK_SIZE, bytes.size - offset)
                val chunk = bytes.copyOfRange(offset, offset + len)
                val written = connection.bulkTransfer(endpoint, chunk, chunk.size, WRITE_TIMEOUT_MS)
                if (written < 0 || written != chunk.size) {
                    throw PrintFailure(
                        "write_failed",
                        "Printer accepted $written of ${chunk.size} bytes.",
                    )
                }
                offset += written
            }
        } finally {
            try {
                connection.releaseInterface(iface)
            } catch (_: Exception) {
                // Best effort; the connection close below is what matters.
            }
            connection.close()
        }
    }

    private fun bulkOutEndpoint(
        iface: android.hardware.usb.UsbInterface,
    ): android.hardware.usb.UsbEndpoint? {
        for (i in 0 until iface.endpointCount) {
            val endpoint = iface.getEndpoint(i)
            if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                endpoint.direction == UsbConstants.USB_DIR_OUT
            ) {
                return endpoint
            }
        }
        return null
    }

    // ------------------------------------------------------------------
    // Result delivery (always on the main thread)
    // ------------------------------------------------------------------

    private fun postSuccess(result: MethodChannel.Result) {
        mainHandler.post { result.success(null) }
    }

    private fun postError(result: MethodChannel.Result, code: String, message: String?) {
        mainHandler.post { result.error(code, message, null) }
    }
}
