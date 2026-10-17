import { useState } from 'react';
import { router } from 'expo-router';
import {
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';
import { scaleTabletTypography } from '../utils/typography';

export default function LoginScreen() {
	const { signIn } = useMenu();
	const { width } = useWindowDimensions();
	const logoSize = Math.max(0, Math.min(width - 56, width < 640 ? 260 : 500));
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [signingIn, setSigningIn] = useState(false);

	async function handleLogin() {
		const trimmedUsername = username.trim();

		if (!trimmedUsername || !password) {
			setError('Enter your username and password to continue.');
			return;
		}

		setSigningIn(true);
		try {
			await signIn(trimmedUsername, password);
			setError('');
			router.replace('/menudashboard');
		} catch (loginError) {
			setError(loginError.message || 'Could not sign in. Check your connection and try again.');
		} finally {
			setSigningIn(false);
		}
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
					<View style={styles.logoWrap}>
						<Image
							source={require('../assets/cafe101logo.png')}
							style={[styles.logo, { height: logoSize, width: logoSize }]}

							resizeMode="contain"
						/>
					</View>

					<View style={styles.formContainer}>

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
						{error ? <Text style={styles.error}>{error}</Text> : null}

						<Pressable
							accessibilityRole="button"
							disabled={signingIn}
							onPress={handleLogin}
							style={({ pressed }) => [styles.loginButton, (pressed || signingIn) && styles.loginButtonPressed]}
						>
							<Text style={styles.loginButtonText}>{signingIn ? 'SIGNING IN...' : 'SIGN IN'}</Text>

						</Pressable>
					</View>

					<Pressable
						accessibilityRole="button"
						onPress={() => router.push('/currentorders')}
						style={({ pressed }) => [styles.currentOrdersButton, pressed && styles.currentOrdersButtonPressed]}
					>
						<Text style={styles.currentOrdersButtonText}>VIEW CURRENT ORDERS</Text>
					</Pressable>

					<View style={styles.footer}>
						<View style={styles.footerLine} />
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

const styles = StyleSheet.create(scaleTabletTypography({
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
	logoWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 24,
	},
	logo: {
		maxWidth: '100%',
	},
	formContainer: {
		alignSelf: 'center',
		backgroundColor: '#FFFCF8',
		borderColor: colors.border,
		borderRadius: 12,
		borderWidth: 1,
		maxWidth: 480,
		padding: 24,
		width: '100%',
	},
	currentOrdersButton: {
		alignItems: 'center',
		alignSelf: 'center',
		borderColor: colors.terracotta,
		borderRadius: 8,
		borderWidth: 1,
		justifyContent: 'center',
		marginTop: 18,
		maxWidth: 480,
		minHeight: 50,
		width: '100%',
	},
	currentOrdersButtonPressed: {
		backgroundColor: '#EEE7DC',
	},
	currentOrdersButtonText: {
		color: colors.terracottaDark,
		fontSize: 12,
		fontWeight: '800',
		letterSpacing: 1.2,

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
		color: '#B38D70',
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
		backgroundColor: '#6D5236',
		borderRadius: 6,
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
		minHeight: 58,
		paddingHorizontal: 20,
	},
	loginButtonPressed: {
		backgroundColor: '#5e563c'
,
	},
	loginButtonText: {
		color: 'black',	
		fontSize: 13,
		fontWeight: '800',
		letterSpacing: 1.8,
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
}));
