Pod::Spec.new do |s|
  s.name = 'ClosetWardrobeCutout'
  s.version = '1.0.0'
  s.summary = 'Removes wardrobe photo backgrounds on device with Apple Vision.'
  s.description = s.summary
  s.homepage = 'https://github.com/MyeongwuKim/closet'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Wearroom'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/MyeongwuKim/closet.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
end
