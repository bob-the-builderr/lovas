import WidgetKit
import SwiftUI

// ---------------------------------------------------------------------------
// Shared data contract with the React Native app.
//
// The JS side writes a single JSON blob into the App Group UserDefaults suite
// (via ExtensionStorage from @bacons/apple-targets). The widget extension runs
// in a separate process, so it reads it directly from the same suite.
// Key must match lib/widgets/constants.ts on the JS side.
// ---------------------------------------------------------------------------

private enum Constants {
  static let appGroup = "group.com.myapp.app"
  static let contentKey = "lovas.widget.content"
}

/// Point in board coordinate space.
struct WidgetPoint: Codable {
  let x: Double
  let y: Double
}

/// Vector stroke from the shared whiteboard.
struct WidgetStroke: Codable {
  let points: [WidgetPoint]
  let color: String
  let strokeWidth: Double
}

/// Copy of lib/widgets/types.ts (WidgetContent). The widget renders this board.
struct WidgetContent: Codable {
  let boardId: String
  let title: String
  let message: String?
  let accentColor: String?
  let variant: WidgetVariant?
  let strokes: [WidgetStroke]?
  let canvasWidth: Double?
  let canvasHeight: Double?
  let updatedAt: Double
}

enum WidgetVariant: String, Codable {
  case heart
  case heartTitle
  case heartNote
  case heartTitleNote

  var showsTitle: Bool { self == .heartTitle || self == .heartTitleNote }
  var showsNote: Bool { self == .heartNote || self == .heartTitleNote }
}

// ---------------------------------------------------------------------------
// Timeline entry + provider
// ---------------------------------------------------------------------------

struct Entry: TimelineEntry {
  let date: Date
  let content: WidgetContent?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: .now, content: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: .now, content: Self.loadContent()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = Entry(date: .now, content: Self.loadContent())
    let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private static func loadContent() -> WidgetContent? {
    guard let defaults = UserDefaults(suiteName: Constants.appGroup),
          let raw = defaults.string(forKey: Constants.contentKey),
          let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(WidgetContent.self, from: data)
  }
}

// ---------------------------------------------------------------------------
// Color parsing
// ---------------------------------------------------------------------------

private func parseHex(_ hex: String, fallback: Color) -> Color {
  var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
  if value.hasPrefix("#") { value.removeFirst() }
  guard value.count == 6, let int = Int(value, radix: 16) else { return fallback }
  let r = Double((int >> 16) & 0xff) / 255.0
  let g = Double((int >> 8) & 0xff) / 255.0
  let b = Double(int & 0xff) / 255.0
  return Color(red: r, green: g, blue: b)
}

// ---------------------------------------------------------------------------
// Vector Whiteboard Drawing Engine in SwiftUI
// ---------------------------------------------------------------------------

struct StrokePath: Shape {
  let points: [WidgetPoint]
  let scale: Double
  let offsetX: Double
  let offsetY: Double

  func path(in rect: CGRect) -> Path {
    var path = Path()
    guard let first = points.first else { return path }
    path.move(to: CGPoint(x: offsetX + first.x * scale, y: offsetY + first.y * scale))

    if points.count == 2 {
      let pt = points[1]
      path.addLine(to: CGPoint(x: offsetX + pt.x * scale, y: offsetY + pt.y * scale))
      return path
    }

    // Midpoint quadratic Bézier smoothing (matches React Native DrawingCanvas)
    for i in 1..<(points.count - 1) {
      let p0 = points[i]
      let p1 = points[i + 1]
      let midX = (p0.x + p1.x) / 2.0
      let midY = (p0.y + p1.y) / 2.0
      path.addQuadCurve(
        to: CGPoint(x: offsetX + midX * scale, y: offsetY + midY * scale),
        control: CGPoint(x: offsetX + p0.x * scale, y: offsetY + p0.y * scale)
      )
    }

    if let last = points.last {
      path.addLine(to: CGPoint(x: offsetX + last.x * scale, y: offsetY + last.y * scale))
    }

    return path
  }
}

struct DrawingBoardView: View {
  let strokes: [WidgetStroke]
  let canvasWidth: Double
  let canvasHeight: Double

  var body: some View {
    GeometryReader { geo in
      let cW = max(canvasWidth, 1.0)
      let cH = max(canvasHeight, 1.0)
      let scaleX = geo.size.width / cW
      let scaleY = geo.size.height / cH
      let scale = min(scaleX, scaleY)
      let offsetX = (geo.size.width - cW * scale) / 2.0
      let offsetY = (geo.size.height - cH * scale) / 2.0

      ZStack {
        ForEach(Array(strokes.enumerated()), id: \.offset) { _, stroke in
          let strokeColor = parseHex(stroke.color, fallback: Color(red: 1.0, green: 0.35, blue: 0.47))
          let scaledWidth = max(stroke.strokeWidth * scale, 1.5)

          if stroke.points.count == 1, let pt = stroke.points.first {
            Circle()
              .fill(strokeColor)
              .frame(width: scaledWidth, height: scaledWidth)
              .position(x: offsetX + pt.x * scale, y: offsetY + pt.y * scale)
          } else if stroke.points.count > 1 {
            StrokePath(points: stroke.points, scale: scale, offsetX: offsetX, offsetY: offsetY)
              .stroke(strokeColor, style: StrokeStyle(lineWidth: scaledWidth, lineCap: .round, lineJoin: .round))
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Content layout: primary widget (home screen)
// ---------------------------------------------------------------------------

struct WidgetHomeView: View {
  let content: WidgetContent?
  let accent: Color
  let soft: Color

  var body: some View {
    Group {
      if let content = content {
        let title = content.title.isEmpty ? "Our Board" : content.title
        let strokes = content.strokes ?? []
        let canvasW = content.canvasWidth ?? 360.0
        let canvasH = content.canvasHeight ?? 360.0

        VStack(spacing: 4) {
          // Top title bar
          HStack {
            Text(title)
              .font(.caption2.weight(.bold))
              .foregroundStyle(accent)
              .lineLimit(1)
            Spacer(minLength: 0)
            Circle()
              .fill(accent)
              .frame(width: 5, height: 5)
          }
          .padding(.horizontal, 4)

          // Whiteboard drawing area
          if !strokes.isEmpty {
            DrawingBoardView(strokes: strokes, canvasWidth: canvasW, canvasHeight: canvasH)
              .frame(maxWidth: .infinity, maxHeight: .infinity)
              .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          } else {
            emptyBoard
          }
        }
      } else {
        placeholder
      }
    }
    .padding(10)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background {
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .fill(Color(red: 1.0, green: 0.98, blue: 0.98)) // Lovas paper tint
        .overlay(
          RoundedRectangle(cornerRadius: 24, style: .continuous)
            .stroke(Color(red: 0.95, green: 0.88, blue: 0.90), lineWidth: 1)
        )
    }
  }

  private var emptyBoard: some View {
    VStack(spacing: 6) {
      Text("🎨")
        .font(.system(size: 28))
      Text("Draw together on Lovas ❤️")
        .font(.caption2.weight(.medium))
        .foregroundStyle(accent)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var placeholder: some View {
    VStack(spacing: 8) {
      Text("💝")
        .font(.system(size: 32))
      Text("Open Lovas to draw ✨")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(accent)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

// ---------------------------------------------------------------------------
// Content layout: lock screen accessory
// ---------------------------------------------------------------------------

struct WidgetAccessoryView: View {
  let content: WidgetContent?
  let accent: Color
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        ZStack {
          AccessoryWidgetBackground()
          if let strokes = content?.strokes, !strokes.isEmpty {
            DrawingBoardView(
              strokes: strokes,
              canvasWidth: content?.canvasWidth ?? 360,
              canvasHeight: content?.canvasHeight ?? 360
            )
            .padding(4)
          } else {
            Image(systemName: "pencil.and.outline")
              .font(.caption)
              .foregroundStyle(accent)
          }
        }
      case .accessoryRectangular:
        HStack(spacing: 8) {
          if let strokes = content?.strokes, !strokes.isEmpty {
            DrawingBoardView(
              strokes: strokes,
              canvasWidth: content?.canvasWidth ?? 360,
              canvasHeight: content?.canvasHeight ?? 360
            )
            .frame(width: 42, height: 42)
          } else {
            Image(systemName: "heart.fill")
              .font(.title3)
              .foregroundStyle(accent)
          }
          VStack(alignment: .leading, spacing: 2) {
            Text((content?.title.isEmpty ?? true) ? "Our Board" : content!.title)
              .font(.caption2.weight(.semibold))
              .lineLimit(1)
            Text(content?.strokes?.isEmpty ?? true ? "Draw with me" : "Shared art ❤️")
              .font(.caption2)
              .lineLimit(1)
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
      default:
        Image(systemName: "pencil")
          .font(.caption)
          .foregroundStyle(accent)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry view — adapt layout to the widget family
// ---------------------------------------------------------------------------

struct BoardWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: Provider.Entry

  private var accent: Color {
    let hex = entry.content?.accentColor
    return parseHex(hex ?? "", fallback: Color(red: 1.0, green: 0.35, blue: 0.47)) // Lovas rose
  }

  private var soft: Color {
    accent.opacity(0.22)
  }

  var body: some View {
    Group {
      switch family {
      case .systemSmall, .systemMedium, .systemLarge, .systemExtraLarge:
        WidgetHomeView(content: entry.content, accent: accent, soft: soft)
      case .accessoryCircular, .accessoryRectangular, .accessoryInline:
        WidgetAccessoryView(content: entry.content, accent: accent)
      @unknown default:
        WidgetHomeView(content: entry.content, accent: accent, soft: soft)
      }
    }
    .containerBackground(for: .widget) {
      Color(uiColor: .systemBackground)
    }
  }
}

// ---------------------------------------------------------------------------
// Widget declaration
// ---------------------------------------------------------------------------

struct LovasBoardWidget: Widget {
  let kind: String = "lovasBoard"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      BoardWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Lovas Board")
    .description("Your shared couple card at a glance — home screen and lock screen.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .systemLarge,
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline,
    ])
    .contentMarginsDisabled()
  }
}