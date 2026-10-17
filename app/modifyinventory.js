import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';
import { scaleTabletTypography } from '../utils/typography';

const emptyForm = { name: '', unit: '', quantity: '', lowStockWarningAt: '' };


export default function ModifyInventory() {
	const { inventoryItems, menuItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useMenu();
	const [formVisible, setFormVisible] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [form, setForm] = useState(emptyForm);
	const [formError, setFormError] = useState('');
	const [stockItemId, setStockItemId] = useState(null);
	const [stockText, setStockText] = useState('');
	const [stockError, setStockError] = useState('');
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);

	const sortedItems = useMemo(
		() => [...(inventoryItems || [])].sort((a, b) => a.name.localeCompare(b.name)),
		[inventoryItems],
	);
	const outOfStockItems = sortedItems.filter((item) => Number(item.quantity) <= 0);
	const lowStockItems = sortedItems.filter((item) => (
		Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderPoint)
	));

	// Which menu items use each inventory item (matched by name + unit, same as menucontext)

	const usageById = useMemo(() => {
		const usage = {};
		(menuItems || []).forEach((menuItem) => {
			(menuItem.ingredients || []).forEach((ingredient) => {
				const id = getInventoryKey(ingredient.name, ingredient.unit);
				usage[id] = [...(usage[id] || []), menuItem.name];
			});
		});
		return usage;
	}, [menuItems]);

	const deleteTarget = sortedItems.find((item) => item.id === confirmDeleteId);
	const deleteBlockedBy = deleteTarget ? usageById[deleteTarget.id] || [] : [];
	const stockTarget = sortedItems.find((item) => item.id === stockItemId);

	// ---- Add / edit form ----
	function openAddForm() {
		setEditingId(null);
		setForm(emptyForm);
		setFormError('');
		setFormVisible(true);
	}

	function openEditForm(item) {
		setEditingId(item.id);
		setForm({
			name: item.name,
			unit: item.unit,
			quantity: String(item.quantity),
			lowStockWarningAt: String(item.reorderPoint),

		});
		setFormError('');
		setFormVisible(true);
	}

	function closeForm() {
		setFormVisible(false);
		setEditingId(null);
		setForm(emptyForm);
		setFormError('');
	}

	function updateField(key, value) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	function saveForm() {
		const name = form.name.trim();
		const unit = form.unit.trim();
		const quantity = Number.parseFloat(form.quantity);
		const lowStockWarningAt = Number.parseFloat(form.lowStockWarningAt);


		if (!editingId) {
			if (!name) return setFormError('Item name is required.');
			if (!unit) return setFormError('Unit is required (for example g, ml, or piece).');
			if (!Number.isFinite(quantity) || quantity < 0) return setFormError('Stock on hand must be 0 or more.');
		}
		if (!Number.isFinite(lowStockWarningAt) || lowStockWarningAt < 0) return setFormError('Low-stock warning amount must be 0 or more.');

		if (editingId) {
			updateInventoryItem(editingId, { reorderPoint: lowStockWarningAt });
		} else {
			// restockAmount is no longer used by this screen; it is kept on the record so the API and database keep working.
			const result = addInventoryItem({ name, unit, quantity, reorderPoint: lowStockWarningAt, restockAmount: Math.max(lowStockWarningAt, 1) });

			if (!result?.added) return setFormError(result?.message || 'Could not add this item.');
		}

		closeForm();
	}

	// ---- Set exact stock ----
	function openStockForm(item) {
		setStockItemId(item.id);
		setStockText(String(item.quantity));
		setStockError('');
	}

	function closeStockForm() {
		setStockItemId(null);
		setStockText('');
		setStockError('');
	}

	function saveStock() {
		const quantity = Number.parseFloat(stockText);
		if (!Number.isFinite(quantity) || quantity < 0) {
			setStockError('Enter a stock amount of 0 or more.');
			return;
		}

		updateInventoryItem(stockItemId, { quantity: Math.round((quantity + Number.EPSILON) * 100) / 100 });
		closeStockForm();
	}

	// ---- Delete ----
	function confirmDelete() {
		if (deleteTarget && !deleteBlockedBy.length) deleteInventoryItem(deleteTarget.id);
		setConfirmDeleteId(null);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
			<View style={styles.header}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Text style={styles.backButtonText}>{'<'}  Back</Text>
				</Pressable>
				<Pressable onPress={openAddForm} style={styles.addButton}>
					<Text style={styles.addButtonText}>+ Add Item</Text>
				</Pressable>
			</View>

			<View style={styles.titleBlock}>
				<Text style={styles.title}>Modify Inventory</Text>
			</View>

			{outOfStockItems.length || lowStockItems.length ? (
				<View style={styles.warningBanner} accessibilityRole="alert">
					<Text style={styles.warningTitle}>Inventory needs attention</Text>
					<Text style={styles.warningMessage}>
						{outOfStockItems.length ? `${outOfStockItems.length} out of stock` : ''}
						{outOfStockItems.length && lowStockItems.length ? ' · ' : ''}
						{lowStockItems.length ? `${lowStockItems.length} low stock` : ''}
					</Text>
					<Text style={styles.warningItems}>
						{[...outOfStockItems, ...lowStockItems].map((item) => item.name).join(', ')}
					</Text>
				</View>
			) : null}

			<FlatList
				columnWrapperStyle={styles.inventoryGridRow}
				contentContainerStyle={styles.list}
				data={sortedItems}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={<Text style={styles.emptyState}>No inventory items yet. Tap "+ Add Item" to create one.</Text>}
				numColumns={2}
				renderItem={({ item }) => {
					const out = Number(item.quantity) <= 0;
					const low = !out && Number(item.quantity) <= Number(item.reorderPoint);

					return (
						<View style={styles.card}>
							<View style={styles.cardTop}>
								<View style={styles.cardNameBlock}>
									<Text style={styles.cardName}>{item.name}</Text>

								</View>
								<View style={styles.stockBlock}>
									<Text style={[styles.stockValue, low && styles.stockValueLow]}>{item.quantity}</Text>
									<Text style={styles.stockUnit}>{item.unit}</Text>
								</View>
							</View>
							{out || low ? (
								<Text style={[styles.lowBadge, out && styles.outBadge]}>
									{out ? 'OUT OF STOCK' : 'LOW STOCK'}
								</Text>
							) : null}
							<View style={styles.cardActions}>
								<Pressable onPress={() => openStockForm(item)} style={styles.stockButton}>
									<Text style={styles.stockButtonText}>SET STOCK</Text>
								</Pressable>
								<Pressable onPress={() => openEditForm(item)} style={styles.editButton}>
									<Text style={styles.editButtonText}>EDIT</Text>
								</Pressable>
								<Pressable onPress={() => setConfirmDeleteId(item.id)} style={styles.deleteButton}>
									<Text style={styles.deleteButtonText}>DELETE</Text>
								</Pressable>
							</View>
						</View>
					);
				}}
				showsVerticalScrollIndicator={false}
			/>
			</KeyboardAvoidingView>


			{/* Add / edit form */}
			<Modal animationType="slide" transparent visible={formVisible} onRequestClose={closeForm}>
				<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
					<View style={styles.formSheet}>
						<View style={styles.formHeader}>
							<Text style={styles.formTitle}>{editingId ? 'Edit inventory item' : 'Add inventory item'}</Text>
							<Pressable onPress={closeForm} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>X</Text>
							</Pressable>
						</View>

						<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
							<Text style={styles.fieldLabel}>NAME</Text>
							{editingId ? (
								<View style={[styles.fieldInput, styles.fieldInputLocked]}>
									<Text style={styles.lockedText}>{form.name}</Text>
								</View>
							) : (
								<TextInput
									onChangeText={(value) => updateField('name', value)}
									placeholder="e.g. Oat milk"
									placeholderTextColor={colors.muted}

									style={styles.fieldInput}
									value={form.name}
								/>
							)}

							<Text style={styles.fieldLabel}>UNIT</Text>
							{editingId ? (
								<View style={[styles.fieldInput, styles.fieldInputLocked]}>
									<Text style={styles.lockedText}>{form.unit}</Text>
								</View>
							) : (
								<TextInput
									autoCapitalize="none"
									onChangeText={(value) => updateField('unit', value)}
									placeholder="g, ml, or piece"
									placeholderTextColor={colors.muted}

									style={styles.fieldInput}
									value={form.unit}
								/>
							)}
							{editingId ? (
								<Text style={styles.helperText}>Name and unit can't be changed because recipes are linked to them. Delete and re-add the item to change them.</Text>
							) : null}

							{!editingId ? (
								<>
									<Text style={styles.fieldLabel}>STOCK ON HAND</Text>
									<TextInput
										keyboardType="decimal-pad"
										onChangeText={(value) => updateField('quantity', value)}
										placeholder="0"
										placeholderTextColor={colors.muted}

										style={styles.fieldInput}
										value={form.quantity}
									/>
								</>
							) : null}

							<Text style={styles.fieldLabel}>LOW-STOCK WARNING AT ({form.unit || 'unit'})</Text>
							<TextInput
								keyboardType="decimal-pad"
								onChangeText={(value) => updateField('lowStockWarningAt', value)}
								placeholder="0"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.lowStockWarningAt}
							/>
							<Text style={styles.helperText}>Show a low-stock warning when stock on hand reaches this amount or less.</Text>


							{formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

							<Pressable onPress={saveForm} style={styles.saveButton}>
								<Text style={styles.saveButtonText}>{editingId ? 'SAVE CHANGES' : 'ADD ITEM'}</Text>
							</Pressable>
						</ScrollView>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Set exact stock */}
			<Modal animationType="fade" transparent visible={Boolean(stockItemId)} onRequestClose={closeStockForm}>
				<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.confirmBackdrop}>
					<View style={styles.confirmCard}>
						<Text style={styles.confirmTitle}>Set stock for {stockTarget?.name}</Text>
						<Text style={styles.confirmBody}>Type the exact amount you have on hand. This replaces the current count.</Text>

						<Text style={styles.fieldLabel}>STOCK ON HAND ({stockTarget?.unit})</Text>
						<TextInput
							autoFocus
							keyboardType="decimal-pad"
							onChangeText={(value) => {
								setStockText(value);
								setStockError('');
							}}
							onSubmitEditing={saveStock}
							placeholder="0"
							placeholderTextColor={colors.muted}
							selectTextOnFocus
							style={styles.fieldInput}
							value={stockText}
						/>
						{stockError ? <Text style={styles.formErrorText}>{stockError}</Text> : null}

						<View style={styles.confirmActions}>
							<Pressable onPress={closeStockForm} style={styles.confirmCancel}>
								<Text style={styles.confirmCancelText}>Cancel</Text>
							</Pressable>
							<Pressable onPress={saveStock} style={styles.confirmPrimary}>
								<Text style={styles.confirmPrimaryText}>Save</Text>
							</Pressable>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Delete confirmation */}
			<Modal animationType="fade" transparent visible={Boolean(confirmDeleteId)} onRequestClose={() => setConfirmDeleteId(null)}>
				<View style={styles.confirmBackdrop}>
					<View style={styles.confirmCard}>
						{deleteBlockedBy.length ? (
							<>
								<Text style={styles.confirmTitle}>Can't delete {deleteTarget?.name}</Text>
								<Text style={styles.confirmBody}>It's used in: {deleteBlockedBy.join(', ')}. Remove it from those recipes first.</Text>
								<View style={styles.confirmActions}>
									<Pressable onPress={() => setConfirmDeleteId(null)} style={styles.confirmCancel}>
										<Text style={styles.confirmCancelText}>OK</Text>
									</Pressable>
								</View>
							</>
						) : (
							<>
								<Text style={styles.confirmTitle}>Delete {deleteTarget?.name}?</Text>
								<Text style={styles.confirmBody}>This removes the item and its stock count. It can't be undone.</Text>
								<View style={styles.confirmActions}>
									<Pressable onPress={() => setConfirmDeleteId(null)} style={styles.confirmCancel}>
										<Text style={styles.confirmCancelText}>Cancel</Text>
									</Pressable>
									<Pressable onPress={confirmDelete} style={styles.confirmDelete}>
										<Text style={styles.confirmDeleteText}>Delete</Text>
									</Pressable>
								</View>
							</>
						)}
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

function getInventoryKey(name, unit) {
	return `${String(name).trim().toLowerCase()}-${String(unit).trim().toLowerCase()}`;
}

// Same warm scheme as the order summary and payment screens
const colors = {
	background: '#F6F2EC',
	ink: '#25170E',
	muted: '#817D75',
	terracotta: '#6D5236',
	border: '#DED6CB',
	panel: '#FFFDF9',
	danger: '#A33F32',
	locked: '#EEE7DC',
};

const styles = StyleSheet.create(scaleTabletTypography({

	safeArea: { backgroundColor: colors.background, flex: 1 },
	keyboardAvoiding: { flex: 1 },
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 18 },
	backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
	backButtonText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
	addButton: { backgroundColor: colors.terracotta, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 11 },
	addButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	titleBlock: { paddingHorizontal: 24, paddingTop: 14 },
	title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	warningBanner: { backgroundColor: '#F8E8E4', borderColor: '#E8BEB5', borderRadius: 9, borderWidth: 1, marginHorizontal: 24, marginTop: 14, padding: 14 },
	warningTitle: { color: colors.danger, fontSize: 14, fontWeight: '800' },
	warningMessage: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
	warningItems: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
	list: { padding: 24, paddingTop: 18 },
	inventoryGridRow: { gap: 12 },
	emptyState: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 30, textAlign: 'center' },
	card: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flex: 1, marginBottom: 12, minWidth: 0, padding: 14 },

	cardTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
	cardNameBlock: { flex: 1, gap: 4, paddingRight: 12 },
	cardName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	stockBlock: { alignItems: 'flex-end' },
	stockValue: { color: colors.ink, fontSize: 24, fontWeight: '800' },
	stockValueLow: { color: colors.danger },
	stockUnit: { color: colors.muted, fontSize: 11, fontWeight: '700' },
	lowBadge: { color: colors.danger, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
	outBadge: { color: '#7B241C' },
	cardActions: { flexDirection: 'row', gap: 10 },
	stockButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 42 },
	stockButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	editButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42 },
	editButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	deleteButton: { alignItems: 'center', borderColor: colors.danger, borderRadius: 6, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42 },
	deleteButtonText: { color: colors.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },

	modalBackdrop: { backgroundColor: 'rgba(37, 23, 14, 0.55)', flex: 1, justifyContent: 'flex-end' },
	formSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%', padding: 24, paddingBottom: 34 },
	formHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
	formTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
	closeButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },

	fieldInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 6, borderWidth: 1, color: colors.ink, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
	fieldInputLocked: { backgroundColor: colors.locked },
	lockedText: { color: colors.muted, fontSize: 15 },
	helperText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
	formErrorText: { color: colors.danger, fontSize: 12, marginTop: 14 },
	saveButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, justifyContent: 'center', marginTop: 24, minHeight: 52 },
	saveButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

	confirmBackdrop: { alignItems: 'center', backgroundColor: 'rgba(37, 23, 14, 0.55)', flex: 1, justifyContent: 'center', padding: 32 },
	confirmCard: { backgroundColor: colors.panel, borderRadius: 14, maxWidth: 340, padding: 22, width: '100%' },
	confirmTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 8 },
	confirmBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
	confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
	confirmCancel: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
	confirmCancelText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
	confirmPrimary: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 46 },
	confirmPrimaryText: { color: '#FFF9F1', fontSize: 13, fontWeight: '800' },
	confirmDelete: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 46 },
	confirmDeleteText: { color: '#FFF9F1', fontSize: 13, fontWeight: '800' },
}));
