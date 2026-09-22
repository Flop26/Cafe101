import { useState } from 'react';
import { router } from 'expo-router';
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const demoEmployee = {
	username: 'employee',
	password: 'cafe101',
};

export default function LoginScreen() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');

	function handleLogin() {
		const trimmedUsername = username.trim();

		if (!trimmedUsername || !password) {
			setError('Enter your username and password to continue.');
			return;
		}

		if (trimmedUsername !== demoEmployee.username || password !== demoEmployee.password) {
			setError('Incorrect username or password. Try the demo account below.');
			return;
		}

		setError('');
		router.replace('/menudashboard');
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				style={styles.flex}
			>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.brandRow}>
						<View style={styles.brandMark}>
							<Text style={styles.brandMarkText}>C</Text>
						</View>
						<Text style={styles.brandName}>CAFE101</Text>
					</View>

					<View style={styles.header}>
						<Text style={styles.eyebrow}>EMPLOYEE PORTAL</Text>
						<Text style={styles.title}>Welcome back.</Text>
						<Text style={styles.subtitle}>Sign in to manage today&apos;s cafe operations.</Text>
					</View>

					<View style={styles.form}>
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>USERNAME</Text>
							<TextInput
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="username"
								onChangeText={(value) => {
									setUsername(value);
									setError('');
								}}
								placeholder="Enter your username"
								placeholderTextColor={colors.muted}
								style={styles.input}
								value={username}
							/>
						</View>

						<View style={styles.fieldGroup}>
							<View style={styles.labelRow}>
								<Text style={styles.label}>PASSWORD</Text>
								<Pressable onPress={() => setShowPassword((visible) => !visible)}>
									<Text style={styles.visibilityAction}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
								</Pressable>
							</View>
							<TextInput
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="password"
								onChangeText={(value) => {
									setPassword(value);
									setError('');
								}}
								onSubmitEditing={handleLogin}
								placeholder="Enter your password"
								placeholderTextColor={colors.muted}
								secureTextEntry={!showPassword}
								style={styles.input}
								value={password}
							/>
						</View>

						<View style={styles.demoAccount}>
							<Text style={styles.demoLabel}>DEMO EMPLOYEE ACCOUNT</Text>
							<Text style={styles.demoCredentials}>Username: employee   Password: cafe101</Text>
						</View>

						{error ? <Text style={styles.error}>{error}</Text> : null}

						<Pressable
							accessibilityRole="button"
							onPress={handleLogin}
							style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}
						>
							<Text style={styles.loginButtonText}>SIGN IN</Text>
							<Text style={styles.loginButtonArrow}>-&gt;</Text>
						</Pressable>
					</View>

					<View style={styles.footer}>
						<View style={styles.footerLine} />
						<Text style={styles.footerText}>AUTHORIZED STAFF ONLY</Text>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const colors = {
	background: '#F6F2EC',
	ink: '#20201D',
	muted: '#97948D',
	terracotta: '#B75E43',
	terracottaDark: '#954A34',
	border: '#D8D1C7',
};

const styles = StyleSheet.create({
	safeArea: {
		backgroundColor: colors.background,
		flex: 1,
	},
	flex: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		justifyContent: 'space-between',
		paddingHorizontal: 28,
		paddingVertical: 28,
	},
	brandRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
	},
	brandMark: {
		alignItems: 'center',
		backgroundColor: colors.terracotta,
		borderRadius: 7,
		height: 34,
		justifyContent: 'center',
		transform: [{ rotate: '-8deg' }],
		width: 34,
	},
	brandMarkText: {
		color: '#FFF9F1',
		fontSize: 22,
		fontWeight: '800',
	},
	brandName: {
		color: colors.ink,
		fontSize: 16,
		fontWeight: '800',
		letterSpacing: 2.5,
	},
	header: {
		marginTop: 72,
	},
	eyebrow: {
		color: colors.terracotta,
		fontSize: 12,
		fontWeight: '800',
		letterSpacing: 2.2,
		marginBottom: 14,
	},
	title: {
		color: colors.ink,
		fontSize: 42,
		fontWeight: '800',
		letterSpacing: -1,
		lineHeight: 48,
	},
	subtitle: {
		color: '#6F6B64',
		fontSize: 16,
		lineHeight: 24,
		marginTop: 12,
		maxWidth: 290,
	},
	form: {
		marginTop: 48,
	},
	fieldGroup: {
		marginBottom: 24,
	},
	labelRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	label: {
		color: colors.ink,
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 1.5,
		marginBottom: 9,
	},
	visibilityAction: {
		color: colors.terracotta,
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 1.2,
		marginBottom: 9,
	},
	input: {
		borderBottomColor: colors.border,
		borderBottomWidth: 1,
		color: colors.ink,
		fontSize: 16,
		paddingBottom: 13,
		paddingHorizontal: 0,
		paddingTop: 0,
	},
	error: {
		color: '#A33F32',
		fontSize: 13,
		marginBottom: 16,
	},
	demoAccount: {
		backgroundColor: '#EEE7DC',
		borderRadius: 6,
		marginBottom: 18,
		padding: 12,
	},
	demoLabel: {
		color: colors.terracotta,
		fontSize: 10,
		fontWeight: '800',
		letterSpacing: 1.2,
		marginBottom: 5,
	},
	demoCredentials: {
		color: '#6F6B64',
		fontSize: 12,
	},
	loginButton: {
		alignItems: 'center',
		backgroundColor: colors.terracotta,
		borderRadius: 6,
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
		minHeight: 58,
		paddingHorizontal: 20,
	},
	loginButtonPressed: {
		backgroundColor: colors.terracottaDark,
	},
	loginButtonText: {
		color: '#FFF9F1',
		fontSize: 13,
		fontWeight: '800',
		letterSpacing: 1.8,
	},
	loginButtonArrow: {
		color: '#FFF9F1',
		fontSize: 22,
		fontWeight: '300',
	},
	footer: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
		marginTop: 58,
	},
	footerLine: {
		backgroundColor: colors.border,
		flex: 1,
		height: 1,
	},
	footerText: {
		color: colors.muted,
		fontSize: 10,
		fontWeight: '800',
		letterSpacing: 1.2,
	},
});
