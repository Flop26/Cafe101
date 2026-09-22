import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

const paymentOptions = [
	{ id: 'cash', label: 'Cash', detail: 'Counter payment' },
	{ id: 'cashless', label: 'Cashless', detail: 'Manual record' },
];

export default function OrderSummary() {
	const { pendingOrder, completePendingOrder } = useMenu();
	const [paymentMethod, setPaymentMethod] = useState('cash');
	const [message, setMessage] = useState('');
	const [messageType, setMessageType] = useState('error');

	function confirmPayment() {
		const result = completePendingOrder(paymentMethod);

		if (!result.completed) {
			setMessageType('error');
			setMessage(result.missing
				? `Not enough stock: ${result.missing.map(formatMissingIngredient).join(', ')}.`
				: result.message);
			return;
		}

		setMessageType('success');
		setMessage(`${result.order.orderNumber} paid by ${formatPaymentMethod(paymentMethod)}.`);
		router.replace('/menudashboard');
	}

	if (!pendingOrder) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<StatusBar style="dark" />
				<View style={styles.emptyState}>
					<Text style={styles.eyebrow}>CAFE101 / ORDER SUMMARY</Text>
					<Text style={styles.title}>No order selected.</Text>
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
						<Text style={styles.eyebrow}>CAFE101 / ORDER SUMMARY</Text>
						<Text style={styles.title}>Finalize order</Text>
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
					<Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
					<View style={styles.paymentGrid}>
						{paymentOptions.map((option) => (
							<Pressable
								key={option.id}
								onPress={() => {
									setPaymentMethod(option.id);
									setMessage('');
								}}
								style={[styles.paymentOption, paymentMethod === option.id && styles.paymentOptionActive]}
							>
								<Text style={[styles.paymentOptionTitle, paymentMethod === option.id && styles.paymentOptionTitleActive]}>{option.label}</Text>
								<Text style={[styles.paymentOptionDetail, paymentMethod === option.id && styles.paymentOptionDetailActive]}>{option.detail}</Text>
							</Pressable>
						))}
					</View>

					{message ? <Text style={[styles.message, messageType === 'success' && styles.messageSuccess]}>{message}</Text> : null}

					<Pressable onPress={confirmPayment} style={styles.actionButton}>
						<Text style={styles.actionButtonText}>CONFIRM {formatPaymentMethod(paymentMethod).toUpperCase()} PAYMENT</Text>
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
	ink: '#20201D',
	muted: '#817D75',
	terracotta: '#B75E43',
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

function formatMissingIngredient(ingredient) {
	const shortage = Math.max(0, ingredient.amount - ingredient.available);
	return `${ingredient.name} needs ${formatStockQuantity(shortage, ingredient.unit)} more`;
}

function formatStockQuantity(value, unit) {
	const amount = Number.parseFloat(value);
	const rounded = Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
	const formatted = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
	return `${formatted} ${unit}`;
}

function formatPaymentMethod(paymentMethod) {
	if (paymentMethod === 'cashless') return 'Cashless';
	return 'Cash';
}

function capitalize(value) {
	return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	content: { padding: 24, paddingBottom: 42 },
	topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
	eyebrow: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1.7, marginBottom: 8 },
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
	paymentGrid: { flexDirection: 'row', gap: 10 },
	paymentOption: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 88, padding: 14 },
	paymentOptionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
	paymentOptionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
	paymentOptionTitleActive: { color: '#FFF9F1' },
	paymentOptionDetail: { color: colors.muted, fontSize: 12, marginTop: 6 },
	paymentOptionDetailActive: { color: '#CFC7BB' },
	message: { color: '#A33F32', fontSize: 12, lineHeight: 18, marginTop: 14 },
	messageSuccess: { color: '#76835A' },
	actionButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, justifyContent: 'center', marginTop: 16, minHeight: 52 },
	actionButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
	secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 10, minHeight: 48 },
	secondaryButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	emptyState: { flex: 1, justifyContent: 'center', padding: 28 },
});
