import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

export default function OrderSummary() {
	const { pendingOrder } = useMenu();

	if (!pendingOrder) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<StatusBar style="dark" />
				<View style={styles.emptyState}>
					<Pressable onPress={() => router.replace('/menudashboard')} style={styles.actionButton}>
						<Text style={styles.actionButtonText}>RETURN TO ORDER DESK</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.topBar}>
					<View>
						<Text style={styles.title}>Review Order</Text>
					</View>
					<Pressable accessibilityLabel="Back to order desk" onPress={() => router.back()} style={styles.closeButton}>
						<Text style={styles.closeButtonText}>X</Text>
					</Pressable>
				</View>

				<View style={styles.ticket}>
					<View style={styles.ticketHeader}>
						<View>
							<Text style={styles.sectionLabel}>ORDER ENTRY</Text>
							<Text style={styles.orderNumber}>{pendingOrder.orderNumber}</Text>
						</View>
						<Text style={styles.itemCount}>{pendingOrder.itemCount} item{pendingOrder.itemCount === 1 ? '' : 's'}</Text>
					</View>

					{pendingOrder.items.map((item) => {
						const customization = formatCustomization(item.customization);

						return (
							<View key={item.id} style={styles.summaryItem}>
								<View style={styles.itemTopRow}>
									<Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
									<Text style={styles.itemTotal}>₱{item.lineTotal.toFixed(2)}</Text>
								</View>
								<Text style={styles.itemMeta}>₱{item.price.toFixed(2)} each</Text>
								{customization ? <Text style={styles.itemDetail}>{customization}</Text> : null}
								{item.note ? <Text style={styles.itemDetail}>{item.note}</Text> : null}
							</View>
						);
					})}

					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>TOTAL DUE</Text>
						<Text style={styles.total}>₱{pendingOrder.subtotal.toFixed(2)}</Text>
					</View>
				</View>

				<View style={styles.paymentPanel}>
					<Pressable onPress={() => router.push('/paymentpage')} style={styles.actionButton}>
						<Text style={styles.actionButtonText}>PROCEED TO PAYMENT</Text>
					</Pressable>
					<Pressable onPress={() => router.back()} style={styles.secondaryButton}>
						<Text style={styles.secondaryButtonText}>EDIT ORDER</Text>
					</Pressable>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const colors = {
	background: '#F6F2EC',
	ink: '#25170E',
	muted: '#817D75',
	terracotta: '#6D5236',
	border: '#DED6CB',
	panel: '#FFFDF9',
};

function formatCustomization(customization) {
	if (!customization || !Object.keys(customization).length) return '';

	return Object.entries(customization)
		.filter(([, value]) => value)
		.map(([key, value]) => `${capitalize(key)}: ${value}`)
		.join('  /  ');
}

function capitalize(value) {
	return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	content: { padding: 24, paddingBottom: 42 },
	topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
	title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
	closeButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	ticket: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 9, borderWidth: 1, padding: 18 },
	ticketHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
	sectionLabel: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
	orderNumber: { color: colors.ink, fontSize: 24, fontWeight: '800' },
	itemCount: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
	summaryItem: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 15 },
	itemTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
	itemName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 },
	itemTotal: { color: colors.ink, fontSize: 14, fontWeight: '800' },
	itemMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
	itemDetail: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
	totalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 18 },
	totalLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
	total: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	paymentPanel: { marginTop: 22 },
	actionButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, justifyContent: 'center', marginTop: 16, minHeight: 52 },
	actionButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
	secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 10, minHeight: 48 },
	secondaryButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	emptyState: { flex: 1, justifyContent: 'center', padding: 28 },
});