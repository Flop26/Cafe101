import { Stack, router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { MenuProvider } from './menucontext';
import { useMenu } from './menucontext';

export default function RootLayout() {
	return (
		<MenuProvider>
			<ProtectedStack />
		</MenuProvider>
	);
}

function ProtectedStack() {
	const { user } = useMenu();
	const segments = useSegments();

	useEffect(() => {
		const route = segments[0];
		if (!route) return;

		if (!user && route !== 'login' && route !== 'index' && !['currentorders', 'spillagelog'].includes(route)) {
			router.replace('/login');
		} else if (user && (route === 'login' || route === 'index')) {
			router.replace('/menudashboard');
		} else if (user && user.role !== 'admin' && ['modifymenu', 'modifyinventory'].includes(route)) {
			router.replace('/menudashboard');
		}
	}, [segments, user]);

	return (
		<Stack initialRouteName="login">
			<Stack.Screen name="login" options={{ headerShown: false }} />
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="menudashboard" options={{ headerShown: false }} />
			<Stack.Screen name="modifymenu" options={{ headerShown: false }} />
			<Stack.Screen name="ordersummary" options={{ headerShown: false }} />
			<Stack.Screen name="modifyinventory" options={{ headerShown: false }} />
			<Stack.Screen name="spillagelog" options={{ headerShown: false }} />
			<Stack.Screen name="currentorders" options={{ headerShown: false }} />
			<Stack.Screen name="paymentpage" options={{ headerShown: false }} />
		</Stack>
	);
}
