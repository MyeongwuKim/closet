import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

export function NativeAuthBootScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>C</Text>
      </View>
      <Text style={styles.logo}>closet</Text>
      <ActivityIndicator color="#f05a3c" style={styles.indicator} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f0e9',
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#f05a3c',
  },
  brandMarkText: {
    color: '#ffffff',
    fontSize: 29,
    fontWeight: '900',
  },
  logo: {
    marginTop: 16,
    color: '#171714',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  indicator: {
    marginTop: 24,
  },
})
