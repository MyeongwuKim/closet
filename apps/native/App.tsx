import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>closet</Text>
        <Text style={styles.badge}>MVP</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>오늘의 코디</Text>
        <Text style={styles.title}>내 옷 안에서 답을 찾는 옷장</Text>
        <Text style={styles.description}>
          웹에서 검증한 옷장과 주간 플래너 흐름을 네이티브 앱으로 이어갑니다.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f0e9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logo: {
    color: '#171714',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -1,
  },
  badge: {
    borderRadius: 99,
    backgroundColor: '#171714',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: '#f05a3c',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  title: {
    maxWidth: 310,
    color: '#171714',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 48,
  },
  description: {
    maxWidth: 320,
    color: '#6f6c65',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 18,
  },
})
