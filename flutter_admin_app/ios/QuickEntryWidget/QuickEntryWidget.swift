// QuickEntryWidget.swift
//
// SSmart POS home-screen widget: one-tap quick actions that deep-link into
// the Flutter admin app's Quick Entry screen.
//
//   ssmartpos://quick-entry?action=loan|wasool|order|expense
//
// v1 is buttons-only (no live stats): the widget extension cannot read the
// app's Firebase session without an App Group or re-auth, so it stays a
// pure launcher. Tapping a button opens the app with the action pre-selected;
// the user still types name+amount and CONFIRMS before anything is written.
//
// Noir Graphite styling to match the app.

import WidgetKit
import SwiftUI

// MARK: - Timeline

struct QuickEntryEntry: TimelineEntry {
    let date: Date
}

struct QuickEntryProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickEntryEntry {
        QuickEntryEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickEntryEntry) -> Void) {
        completion(QuickEntryEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickEntryEntry>) -> Void) {
        // Static content; refresh twice daily is plenty.
        let next = Calendar.current.date(byAdding: .hour, value: 12, to: Date())!
        completion(Timeline(entries: [QuickEntryEntry(date: Date())], policy: .after(next)))
    }
}

// MARK: - Buttons

struct QuickAction: Identifiable {
    let id: String          // also the ?action= value
    let title: String
    let systemImage: String
    let tint: Color
}

let quickActions: [QuickAction] = [
    QuickAction(id: "loan",    title: "Loan",    systemImage: "arrow.up.right.circle.fill",   tint: .red),
    QuickAction(id: "wasool",  title: "Wasool",  systemImage: "arrow.down.left.circle.fill", tint: .green),
    QuickAction(id: "order",   title: "Order",   systemImage: "cart.fill",                   tint: .blue),
    QuickAction(id: "expense", title: "Kharcha", systemImage: "receipt.fill",                tint: .orange),
]

func actionButton(_ a: QuickAction) -> some View {
    Link(destination: URL(string: "ssmartpos://quick-entry?action=\(a.id)")!) {
        VStack(spacing: 4) {
            Image(systemName: a.systemImage)
                .font(.system(size: 20))
                .foregroundColor(a.tint)
            Text(a.title)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white.opacity(0.06))
        .cornerRadius(10)
    }
}

// MARK: - Views

struct QuickEntrySmallView: View {
    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 2) {
                Image(systemName: "bolt.fill")
                    .foregroundColor(Color(red: 0.83, green: 0.69, blue: 0.22))
                Text("Quick Entry")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }
            HStack(spacing: 8) {
                actionButton(quickActions[0])
                actionButton(quickActions[1])
            }
        }
        .padding(10)
    }
}

struct QuickEntryMediumView: View {
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "bolt.fill")
                    .foregroundColor(Color(red: 0.83, green: 0.69, blue: 0.22))
                Text("SSmart Quick Entry")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Text("tap → type → confirm")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.4))
            }
            HStack(spacing: 8) {
                ForEach(quickActions) { actionButton($0) }
            }
        }
        .padding(12)
    }
}

// MARK: - Widget

struct QuickEntryWidget: Widget {
    let kind = "QuickEntryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickEntryProvider()) { entry in
            QuickEntryWidgetView(entry: entry)
                // iOS 17+: widgets must use containerBackground instead of
                // .background() or the system shows "Please adopt
                // containerBackground API" instead of rendering.
                .containerBackground(for: .widget) {
                    Color(red: 0.04, green: 0.04, blue: 0.05)
                }
        }
        .configurationDisplayName("SSmart Quick Entry")
        .description("One-tap khata, vendor order and expense entry.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct QuickEntryWidgetView: View {
    var entry: QuickEntryEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            QuickEntrySmallView()
        default:
            QuickEntryMediumView()
        }
    }
}
