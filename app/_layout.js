import { Stack } from 'expo-router';
import { MenuProvider } from './menucontext';

export default function RootLayout() {
	return (
		<MenuProvider>
			<Stack initialRouteName="login">
				<Stack.Screen name="login" options={{ headerShown: false }} />
				<Stack.Screen name="index" options={{ headerShown: false }} />
				<Stack.Screen name="menudashboard" options={{ headerShown: false }} />
				<Stack.Screen name="modifymenu" options={{ headerShown: false }} />
				<Stack.Screen name="ordersummary" options={{ headerShown: false }} />
				<Stack.Screen name="modifyinventory" options={{ headerShown: false }} />
				<Stack.Screen name="spillagelog" options={{ headerShown: false }} />
				<Stack.Screen name="paymentpage" options={{ headerShown: false }} />
			</Stack>
		</MenuProvider>
	);
}
