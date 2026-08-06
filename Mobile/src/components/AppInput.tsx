import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors } from '@/constants/colors';

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function AppInput({ label, error, style, ...props }: AppInputProps) {
  const inputId = props.nativeID || `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <View style={styles.wrapper}>
      <Text nativeID={`${inputId}-label`} style={styles.label}>{label}</Text>
      <TextInput
        nativeID={inputId}
        accessibilityLabel={props.accessibilityLabel || label}
        accessibilityHint={error || props.accessibilityHint}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoCapitalize="none"
        placeholderTextColor={colors.outline}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? (
        <Text nativeID={errorId} accessibilityRole="alert" aria-live="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
});
