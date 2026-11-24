package com.ssmartpos

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // USB OTG thermal-printer transport (MethodChannel
        // com.ssmartpos/usb_printer). Registered here so it exists
        // before any Dart code runs; the plugin itself only touches
        // USB hardware when a print is requested.
        UsbPrinterPlugin(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}
