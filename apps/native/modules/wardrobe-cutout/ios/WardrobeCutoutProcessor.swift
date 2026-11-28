import CoreImage
import Foundation
import ImageIO
import Vision

@available(iOS 17, *)
enum WardrobeCutoutProcessor {
  private static let maxPhotoBytes = 10 * 1024 * 1024
  private static let maxImageDimension = 1200

  /// 원본 방향을 적용해 디코딩한 뒤 Vision이 찾은 전경을 같은 프레임의 투명 PNG에 담는다.
  static func removeBackground(base64: String) throws -> String? {
    guard base64.utf8.count <= ((maxPhotoBytes + 2) / 3) * 4,
          let data = Data(base64Encoded: base64), data.count <= maxPhotoBytes,
          let source = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxImageDimension,
          ] as CFDictionary) else { return nil }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])
    guard let result = request.results?.first, !result.allInstances.isEmpty else { return nil }

    let pixels = try result.generateMaskedImage(
      ofInstances: result.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    )
    let cutout = CIImage(cvPixelBuffer: pixels)
    let context = CIContext(options: [.cacheIntermediates: false])
    let png = context.pngRepresentation(
      of: cutout, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB()
    )
    guard let png, png.count <= maxPhotoBytes else { return nil }
    return png.base64EncodedString()
  }
}
