import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { completeKitchenOrder as completeSharedKitchenOrder, databaseEnabled, loadKitchenOrders } from './api';
import { useMenu } from './menucontext';
import { scaleTabletTypography } from '../utils/typography';

export default function CurrentOrders() {
	const {
		completedOrders = [],
		completedKitchenOrderIds = [],
		completeKitchenOrder: completeLocalKitchenOrder,
		user,
	} = useMenu();
	const { width } = useWindowDimensions();
	const [sharedOrders, setSharedOrders] = useState([]);
	const [syncError, setSyncError] = useState('');
	const [updatingOrderId, setUpdatingOrderId] = useState('');
	const sideBySide = width >= 760;
	const laneWidth = sideBySide ? (width - 60) / 2 : width - 48;
	const numColumns = laneWidth >= 560 ? 2 : 1;
	const localOrders = [...completedOrders].reverse().map((order) => ({
		...order,
		status: completedKitchenOrderIds.includes(order.id) ? 'Completed' : 'Working',
	}));
	const orders = databaseEnabled ? sharedOrders : localOrders;
	const workingOrders = orders.filter((order) => order.status?.toLowerCase() !== 'completed');
	const finishedOrders = orders.filter((order) => order.status?.toLowerCase() === 'completed');

	const refreshOrders = useCallback(async () => {
		const loadedOrders = await loadKitchenOrders();
		if (Array.isArray(loadedOrders)) {
			setSharedOrders(loadedOrders);
			setSyncError('');
		}
	}, []);

	useEffect(() => {
		if (!databaseEnabled) return undefined;
		let active = true;
		const refresh = async () => {
			try {
				const loadedOrders = await loadKitchenOrders();
				if (active && Array.isArray(loadedOrders)) {
					setSharedOrders(loadedOrders);
					setSyncError('');
				}
			} catch (error) {
				if (active) setSyncError(error.message || 'Could not load shared orders.');
			}
		};

		refresh();
		const interval = setInterval(refresh, 5000);
		return () => {
			active = false;
			clearInterval(interval);
		};
	}, []);

	async function markOrderComplete(orderId) {
		setUpdatingOrderId(orderId);
		setSyncError('');
		try {
			if (databaseEnabled) {
				await completeSharedKitchenOrder(orderId);
				await refreshOrders();
			} else {
				completeLocalKitchenOrder(orderId);
			}
		} catch (error) {
			setSyncError(error.message || 'Could not update this order.');
		} finally {
			setUpdatingOrderId('');
		}
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.titleBlock}>
				<View style={styles.titleHeader}>
					<Text style={styles.title}>Current Orders</Text>
					<Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
						<Text style={styles.closeButtonText}>X</Text>
					</Pressable>
				</View>
				<Text style={styles.subtitle}>{databaseEnabled ? 'Shared paid orders · refreshes every 5 seconds' : 'Orders from this app session only · server sync is not configured'}</Text>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.push('/spillagelog')}
					style={[styles.spillageButton, width < 520 && styles.mobileSpillageButton]}
				>
					<Text style={styles.spillageButtonText}>LOG SPILLAGE</Text>
				</Pressable>
			</View>
			{syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
			<View style={[styles.lanes, !sideBySide && styles.lanesStacked]}>
				<OrderLane
					title="Working"
					orders={workingOrders}
					numColumns={numColumns}
					emptyMessage="New paid orders will appear here."
					actionLabel="MARK COMPLETE"
					onComplete={markOrderComplete}
					updatingOrderId={updatingOrderId}
				/>
				<OrderLane
					title="Completed"
					orders={finishedOrders}
					numColumns={numColumns}
					emptyMessage="Orders you finish will appear here."
				/>
			</View>
		</SafeAreaView>
	);
}

function OrderLane({ title, statusLabel, orders, numColumns, emptyMessage, actionLabel, onComplete, updatingOrderId }) {
	return (
		<View style={styles.lane}>
			<View style={styles.laneHeader}>
				<Text style={styles.laneTitle}>{title}</Text>
				<Text style={styles.orderCount}>{orders.length}</Text>
			</View>
			<FlatList
				key={`${title}-${numColumns}`}
				columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
				contentContainerStyle={styles.orderList}
				data={orders}
				keyExtractor={(order) => order.id}
				ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
				numColumns={numColumns}
				renderItem={({ item: order }) => (
					<View style={styles.orderCard}>
						<View style={styles.orderHeader}>
							<View>
								<Text style={styles.orderNumber}>{order.orderNumber}</Text>
								<Text style={styles.orderMeta}>{formatOrderTime(order.paidAt || order.createdAt)}</Text>
							</View>
							<Text style={styles.status}>{statusLabel}</Text>
						</View>

						<View style={styles.itemList}>
							{order.items.map((item, index) => (
								<View key={`${item.id}-${index}`} style={styles.orderItem}>
									<View style={styles.itemDescription}>
										<Text style={styles.itemName}>{item.name}</Text>
										{item.size ? <Text style={styles.itemDetail}>{item.size}</Text> : null}
										{item.note ? <Text style={styles.itemNote}>Note: {item.note}</Text> : null}
									</View>
									<Text style={styles.itemQuantity}>× {item.quantity}</Text>
								</View>
							))}
						</View>

						{actionLabel ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => onComplete(order.id)}
								disabled={updatingOrderId === order.id}
								style={styles.completeButton}
							>
								<Text style={styles.completeButtonText}>{updatingOrderId === order.id ? 'SAVING...' : `✓  ${actionLabel}`}</Text>
							</Pressable>
						) : null}
					</View>
				)}
			/>
		</View>
	);
}

function formatOrderTime(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const colors = {
	background: '#F6F2EC',
	ink: '#25170E',
	muted: '#817D75',
	terracotta: '#6D5236',
	border: '#DED6CB',
	panel: '#FFFDF9',
	success: '#2E7D4F',
};

const styles = StyleSheet.create(scaleTabletTypography({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
	closeButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	spillageButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.terracotta, borderRadius: 8, justifyContent: 'center', marginTop: 14, minHeight: 48, paddingHorizontal: 16 },
	mobileSpillageButton: { alignSelf: 'stretch' },
	spillageButtonText: { color: '#FFF9F1', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
	titleBlock: { paddingHorizontal: 24, paddingTop: 22 },
	titleHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	eyebrow: { color: colors.terracotta, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
	title: { color: colors.ink, flex: 1, fontSize: 30, fontWeight: '800', marginRight: 12 },
	subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
	syncError: { color: '#A33F32', fontSize: 13, marginHorizontal: 24, marginTop: 10 },
	lanes: { flex: 1, flexDirection: 'row', gap: 12, padding: 24, paddingTop: 18 },
	lanesStacked: { flexDirection: 'column' },
	lane: { backgroundColor: '#EEE9E1', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 0, padding: 12 },
	laneHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, paddingHorizontal: 4 },
	laneTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	orderCount: { alignItems: 'center', backgroundColor: colors.panel, borderRadius: 14, color: colors.terracotta, fontSize: 13, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3 },
	orderList: { flexGrow: 1, gap: 12 },
	gridRow: { gap: 12 },
	orderCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, marginBottom: 12, padding: 14 },
	orderHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12 },
	orderNumber: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	orderMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
	status: { color: colors.success, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
	itemList: { gap: 10, paddingTop: 12 },
	orderItem: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
	itemDescription: { flex: 1, paddingRight: 10 },
	itemName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
	itemDetail: { color: colors.muted, fontSize: 12, marginTop: 3 },
	itemNote: { color: colors.terracotta, fontSize: 12, fontStyle: 'italic', marginTop: 3 },
	itemQuantity: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	completeButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 7, justifyContent: 'center', marginTop: 14, minHeight: 42 },
	completeButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
	emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, padding: 14, textAlign: 'center' },
}));
