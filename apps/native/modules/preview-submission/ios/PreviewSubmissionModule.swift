import ExpoModulesCore
import UIKit

/// 룩북 접수 중 앱을 내려도 HTTP 응답을 받을 시간을 확보하고, 완료 또는 iOS 만료 시 반환한다.
public final class PreviewSubmissionModule: Module {
  private var nextId = 0
  private var tasks: [Int: UIBackgroundTaskIdentifier] = [:]

  public func definition() -> ModuleDefinition {
    Name("ClosetPreviewSubmission")

    AsyncFunction("begin") { () -> Int? in
      let id = self.nextId
      self.nextId += 1
      let task = UIApplication.shared.beginBackgroundTask(withName: "Submit AI lookbook") {
        self.endTask(id)
      }
      guard task != .invalid else { return nil }
      self.tasks[id] = task
      return id
    }.runOnQueue(.main)

    AsyncFunction("end") { (id: Int) in
      self.endTask(id)
    }.runOnQueue(.main)
  }

  /// iOS 만료와 JavaScript 종료가 겹치면 먼저 처리한 쪽에서만 작업 시간을 반환한다.
  private func endTask(_ id: Int) {
    guard let task = tasks.removeValue(forKey: id) else { return }
    UIApplication.shared.endBackgroundTask(task)
  }
}
