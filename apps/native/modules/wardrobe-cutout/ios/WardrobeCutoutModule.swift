import ExpoModulesCore
import Foundation

/// 사진 데이터를 기기에서 처리하고 투명 PNG만 WebView에 돌려준다.
public final class WardrobeCutoutModule: Module {
  private let processingQueue = DispatchQueue(label: "closet.wardrobe-cutout", qos: .userInitiated)

  public func definition() -> ModuleDefinition {
    Name("ClosetWardrobeCutout")

    AsyncFunction("removeBackground") { (base64: String) -> String? in
      guard #available(iOS 17, *) else { return nil }
      return try WardrobeCutoutProcessor.removeBackground(base64: base64)
    }.runOnQueue(processingQueue)
  }
}
