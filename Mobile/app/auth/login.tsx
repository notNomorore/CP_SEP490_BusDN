import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLogin } from '@/auth/hooks/useLogin';
import { colors } from '@/constants/colors';

const BRAND_GREEN = '#003120';
const SOFT_MINT = '#ecf6f2';

const DEMO_ACCOUNTS = [
  {
    role: 'Khách hàng',
    icon: 'account' as const,
    accounts: [
      { email: 'vuker1212004@gmail.com', password: 'Vu@1212004' },
      { email: 'huhuhichic64@gmail.com', password: '@Minh123' },
    ],
  },
  {
    role: 'Phụ xe',
    icon: 'ticket-confirmation' as const,
    accounts: [
      { email: 'vunthde180740@fpt.edu.vn', password: 'Vu@1212004' },
      { email: 'trinhminhhai1112@gmail.com', password: 'Tuyettnhy1403@' },
    ],
  },
  {
    role: 'Tài xế',
    icon: 'bus' as const,
    accounts: [
      { email: 'haitmde180679@fpt.edu.vn', password: 'Tuyettnhy1403@' },
    ],
  },
];

export default function LoginScreen() {
  const {
    identifier,
    setIdentifier,
    password,
    setPassword,
    canSubmit,
    error,
    loading,
    login,
    openRegister,
    showForgotPasswordUnavailable,
  } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);
  const { height } = useWindowDimensions();
  const compact = height < 760;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.ambientBackground}>
        <View style={styles.ambientTop} />
        <View style={styles.ambientBottom} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            compact ? styles.scrollContentCompact : null,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={[styles.branding, compact ? styles.brandingCompact : null]}>
              <View style={[styles.logo, compact ? styles.logoCompact : null]}>
                <MaterialCommunityIcons
                  name="bus"
                  size={compact ? 27 : 31}
                  color="#b5efd1"
                />
              </View>
              <Text style={[styles.brandName, compact ? styles.brandNameCompact : null]}>
                BusDN
              </Text>
              <Text style={styles.tagline}>Your premium path through the city.</Text>
            </View>

            <View style={[styles.card, compact ? styles.cardCompact : null]}>
              {error ? (
                <View accessibilityRole="alert" style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email or Phone Number</Text>
                <View
                  style={[
                    styles.inputShell,
                    focusedField === 'identifier' ? styles.inputShellFocused : null,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={focusedField === 'identifier' ? colors.accent : '#717974'}
                  />
                  <TextInput
                    accessibilityLabel="Email or Phone Number"
                    autoCapitalize="none"
                    autoComplete="username"
                    keyboardType="email-address"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setIdentifier}
                    onFocus={() => setFocusedField('identifier')}
                    onSubmitEditing={() => undefined}
                    placeholder="alexander@busdn.com"
                    placeholderTextColor="#89918d"
                    returnKeyType="next"
                    style={styles.input}
                    textContentType="username"
                    value={identifier}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.label}>Password</Text>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={showForgotPasswordUnavailable}
                  >
                    <Text style={styles.forgotLink}>Forgot Password?</Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.inputShell,
                    focusedField === 'password' ? styles.inputShellFocused : null,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={focusedField === 'password' ? colors.accent : '#717974'}
                  />
                  <TextInput
                    accessibilityLabel="Password"
                    autoCapitalize="none"
                    autoComplete="password"
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onSubmitEditing={() => {
                      if (canSubmit && !loading) void login();
                    }}
                    placeholder="Password"
                    placeholderTextColor="#89918d"
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    textContentType="password"
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={() => setShowPassword((visible) => !visible)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color="#717974"
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: loading, disabled: !canSubmit || loading }}
                disabled={!canSubmit || loading}
                onPress={login}
                style={({ pressed }) => [
                  styles.signInButton,
                  (!canSubmit || loading) ? styles.buttonDisabled : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.signInText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.white} />
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showDemoAccounts }}
                onPress={() => setShowDemoAccounts((visible) => !visible)}
                style={({ pressed }) => [styles.demoToggle, pressed ? styles.buttonPressed : null]}
              >
                <View style={styles.demoToggleLabel}>
                  <MaterialCommunityIcons name="key-variant" size={20} color={BRAND_GREEN} />
                  <Text style={styles.demoToggleText}>Tài khoản demo</Text>
                </View>
                <Ionicons
                  name={showDemoAccounts ? 'chevron-up' : 'chevron-down'}
                  size={19}
                  color={BRAND_GREEN}
                />
              </Pressable>

              {showDemoAccounts ? (
                <View style={styles.demoPanel}>
                  <View style={styles.demoHeading}>
                    <Text style={styles.demoTitle}>Đăng nhập nhanh để trải nghiệm</Text>
                    <Text style={styles.demoSubtitle}>Chạm vào tài khoản để tự động điền.</Text>
                  </View>
                  {DEMO_ACCOUNTS.map((group) => (
                    <View key={group.role} style={styles.demoGroup}>
                      <View style={styles.demoRoleRow}>
                        <View style={styles.demoRoleIcon}>
                          <MaterialCommunityIcons name={group.icon} size={17} color={BRAND_GREEN} />
                        </View>
                        <Text style={styles.demoRole}>{group.role}</Text>
                      </View>
                      {group.accounts.map((account) => (
                        <Pressable
                          key={account.email}
                          accessibilityLabel={`Dùng tài khoản ${group.role} ${account.email}`}
                          accessibilityRole="button"
                          onPress={() => {
                            setIdentifier(account.email);
                            setPassword(account.password);
                            setShowDemoAccounts(false);
                          }}
                          style={({ pressed }) => [
                            styles.demoAccount,
                            pressed ? styles.demoAccountPressed : null,
                          ]}
                        >
                          <View style={styles.demoAccountInfo}>
                            <Text selectable style={styles.demoEmail}>{account.email}</Text>
                            <Text selectable style={styles.demoPassword}>{account.password}</Text>
                          </View>
                          <Ionicons name="arrow-forward-circle" size={21} color={colors.accent} />
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>New to BusDN?</Text>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={openRegister}
              >
                <Text style={styles.registerLink}>Register Now</Text>
              </Pressable>
            </View>

            <View style={[styles.trustRow, compact ? styles.trustRowCompact : null]}>
              <View style={styles.trustCard}>
                <MaterialCommunityIcons name="shield-check" size={21} color="#466a5a" />
                <Text style={styles.trustText}>Secure Data</Text>
              </View>
              <View style={styles.trustCard}>
                <MaterialCommunityIcons name="headset" size={21} color="#466a5a" />
                <Text style={styles.trustText}>24/7 Help</Text>
              </View>
            </View>

            <Text style={styles.footer}>
              {'\u00A9 2024 BusDN Transit Systems. Premium Urban Mobility.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2fcf8',
  },
  keyboardView: {
    flex: 1,
  },
  ambientBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientTop: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: 'rgba(181, 239, 209, 0.38)',
  },
  ambientBottom: {
    position: 'absolute',
    right: -170,
    bottom: 30,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(43, 164, 113, 0.09)',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
  },
  scrollContentCompact: {
    justifyContent: 'flex-start',
    paddingTop: 14,
  },
  content: {
    width: '100%',
    maxWidth: 430,
    alignItems: 'stretch',
  },
  branding: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandingCompact: {
    marginBottom: 15,
  },
  logo: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: BRAND_GREEN,
    marginBottom: 14,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5,
  },
  logoCompact: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginBottom: 10,
  },
  brandName: {
    color: colors.primary,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandNameCompact: {
    fontSize: 26,
  },
  tagline: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(193, 200, 195, 0.25)',
    borderRadius: 22,
    backgroundColor: colors.white,
    padding: 24,
    shadowColor: '#001a0f',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 7,
  },
  cardCompact: {
    gap: 14,
    borderRadius: 20,
    padding: 19,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(193, 200, 195, 0.24)',
    borderRadius: 12,
    backgroundColor: SOFT_MINT,
    paddingHorizontal: 14,
  },
  inputShellFocused: {
    borderColor: colors.accent,
    backgroundColor: '#f1faf6',
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  signInButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 27,
    backgroundColor: colors.primary,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0.08,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  signInText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  demoToggle: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0, 49, 32, 0.15)',
    borderRadius: 25,
    backgroundColor: '#f1faf6',
    paddingHorizontal: 18,
  },
  demoToggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  demoToggleText: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '800',
  },
  demoPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 49, 32, 0.11)',
    borderRadius: 18,
    backgroundColor: '#f7fcfa',
    padding: 12,
  },
  demoHeading: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  demoTitle: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '800',
  },
  demoSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  demoGroup: {
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(193, 200, 195, 0.35)',
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 10,
  },
  demoRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  demoRoleIcon: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#e8f7f0',
  },
  demoRole: {
    color: BRAND_GREEN,
    fontSize: 13,
    fontWeight: '900',
  },
  demoAccount: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 11,
    backgroundColor: SOFT_MINT,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  demoAccountPressed: {
    backgroundColor: '#d9f2e7',
    transform: [{ scale: 0.99 }],
  },
  demoAccountInfo: {
    flex: 1,
    gap: 2,
  },
  demoEmail: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  demoPassword: {
    color: colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 22,
  },
  registerPrompt: {
    color: colors.muted,
    fontSize: 14,
  },
  registerLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  trustRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  trustRowCompact: {
    marginTop: 16,
  },
  trustCard: {
    minHeight: 54,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(236, 246, 242, 0.9)',
    paddingHorizontal: 10,
  },
  trustText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    color: '#8a928e',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 20,
    textAlign: 'center',
  },
});
