import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';
import { scaleTabletTypography } from '../utils/typography';

export default function SpillageLog() {
	const { inventoryItems = [], logSpillage, refreshSpillageInventory } = useMenu();

	const { width: screenWidth } = useWindowDimensions();
	const columnCount = screenWidth >= 960 ? 3 : screenWidth >= 640 ? 2 : 1;
	const itemWidth = (screenWidth - 48 - (columnCount - 1) * 8) / columnCount;
	const sortedItems = useMemo(
		() => [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)),
		[inventoryItems],
	);
	const [selectedId, setSelectedId] = useState('');
	const [quantity, setQuantity] = useState('');
	const [reason, setReason] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [saving, setSaving] = useState(false);
	const selectedItem = sortedItems.find((item) => item.id === selectedId) || sortedItems[0];

	useEffect(() => {
		refreshSpillageInventory().catch((loadError) => {
			setError(loadError.message || 'Could not load inventory.');
		});
	}, [refreshSpillageInventory]);


	async function submitSpillage() {
		setError('');
		setSuccess('');
		if (!selectedItem) return setError('There are no inventory items to log.');

		const amount = Number.parseFloat(quantity);
		if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a quantity greater than 0.');
		if (amount > selectedItem.quantity) return setError(`Only ${selectedItem.quantity} ${selectedItem.unit} is currently in stock.`);

		setSaving(true);
		try {
			const result = await logSpillage({ inventoryId: selectedItem.id, quantityWasted: amount, reason });
			if (!result?.logged) {
				setError(result?.message || 'Could not save the spillage log.');
				return;
			}
			setQuantity('');
			setReason('');
			setSuccess(`${amount} ${selectedItem.unit} of ${selectedItem.name} logged. Stock updated.`);
		} catch (saveError) {
			setError(saveError.message || 'Could not save the spillage log.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>

			<View style={styles.header}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Text style={styles.backButtonText}>{'<'}  Back</Text>
				</Pressable>
			</View>
			<View style={styles.titleBlock}>
				<Text style={styles.title}>Waste Log</Text>

			</View>
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<Text style={styles.fieldLabel}>INVENTORY ITEM</Text>
				{sortedItems.length ? (
					<View style={styles.itemList}>
						{sortedItems.map((item) => {
							const selected = item.id === selectedItem?.id;
							return (
								<Pressable
									key={item.id}
									onPress={() => { setSelectedId(item.id); setError(''); setSuccess(''); }}
										style={[styles.itemOption, { width: itemWidth }, selected && styles.itemOptionSelected]}
								>
									<Text style={[styles.itemName, selected && styles.itemNameSelected]}>{item.name}</Text>
									<Text style={[styles.itemStock, selected && styles.itemNameSelected]}>{item.quantity} {item.unit} in stock</Text>
								</Pressable>
							);
						})}
					</View>
				) : <Text style={styles.emptyText}>No inventory items available.</Text>}

				<Text style={styles.fieldLabel}>QUANTITY WASTED ({selectedItem?.unit || 'units'})</Text>
				<TextInput
					keyboardType="decimal-pad"
					onChangeText={(value) => { setQuantity(value); setError(''); setSuccess(''); }}
					placeholder="0"
					placeholderTextColor={colors.muted}
					style={styles.input}
					value={quantity}
				/>

				<Text style={styles.fieldLabel}>REASON (OPTIONAL)</Text>
				<TextInput
					onChangeText={setReason}
					placeholderTextColor={colors.muted}
					style={styles.input}
					value={reason}
				/>

				{error ? <Text style={styles.error}>{error}</Text> : null}
				{success ? <Text style={styles.success}>{success}</Text> : null}
				<Pressable disabled={saving || !selectedItem} onPress={submitSpillage} style={[styles.submitButton, (saving || !selectedItem) && styles.submitDisabled]}>
					<Text style={styles.submitText}>{saving ? 'SAVING...' : 'LOG WASTE'}</Text>
				</Pressable>
			</ScrollView>
			</KeyboardAvoidingView>

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
	danger: '#A33F32',
	success: '#2E7D4F',
};

const styles = StyleSheet.create(scaleTabletTypography({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	keyboardAvoiding: { flex: 1 },

	header: { paddingHorizontal: 24, paddingTop: 18 },
	backButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
	backButtonText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
	titleBlock: { paddingHorizontal: 24, paddingTop: 18 },
	title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	content: { padding: 24, paddingTop: 14 },
	fieldLabel: { color: colors.terracotta, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8, marginTop: 18 },
	itemList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	itemOption: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
	itemOptionSelected: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
	itemName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '700' },
	itemNameSelected: { color: '#FFF9F1' },
	itemStock: { color: colors.muted, fontSize: 13, marginLeft: 10 },
	input: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 6, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
	emptyText: { color: colors.muted, fontSize: 14, paddingVertical: 12 },
	error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginTop: 14 },
	success: { color: colors.success, fontSize: 14, lineHeight: 20, marginTop: 14 },
	submitButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 7, justifyContent: 'center', marginTop: 22, minHeight: 52 },
	submitDisabled: { opacity: 0.55 },
	submitText: { color: '#FFF9F1', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
}));
