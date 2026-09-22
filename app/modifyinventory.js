import { useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

// This screen expects the following to be available from useMenu():
//   inventoryItems        - array of { id, name, unit, quantity, reorderPoint, restockAmount }
//   addInventoryItem(item)          -> creates a new ingredient
//   updateInventoryItem(id, patch)  -> updates name/unit/quantity/reorderPoint/restockAmount
//   deleteInventoryItem(id)         -> removes an ingredient
// If menucontext.js doesn't have these yet, add them there (same pattern as
// updateInventoryStock) so this screen can read/write through the API in server/.

const emptyForm = { name: '', unit: '', quantity: '', reorderPoint: '', restockAmount: '' };

export default function ModifyInventory() {
	const { inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useMenu();
	const [formVisible, setFormVisible] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [form, setForm] = useState(emptyForm);
	const [formError, setFormError] = useState('');
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);

	const sortedInventoryItems = useMemo(
		() => [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)),
		[inventoryItems],
	);

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
			reorderPoint: String(item.reorderPoint),
			restockAmount: String(item.restockAmount),
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
		const reorderPoint = Number.parseFloat(form.reorderPoint);
		const restockAmount = Number.parseFloat(form.restockAmount);

		if (!name || !unit) {
			setFormError('Name and unit are required.');
			return;
		}
		if (!Number.isFinite(quantity) || quantity < 0) {
			setFormError('Quantity must be a valid number.');
			return;
		}
		if (!Number.isFinite(reorderPoint) || reorderPoint < 0) {
			setFormError('Restock-at value must be a valid number.');
			return;
		}
		if (!Number.isFinite(restockAmount) || restockAmount <= 0) {
			setFormError('Restock amount must be greater than zero.');
			return;
		}

		const payload = { name, unit, quantity, reorderPoint, restockAmount };

		if (editingId) {
			updateInventoryItem(editingId, payload);
		} else {
			addInventoryItem(payload);
		}

		closeForm();
	}

	function confirmDelete(id) {
		deleteInventoryItem(id);
		setConfirmDeleteId(null);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.header}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Text style={styles.backButtonText}>{'<'}  Back</Text>
				</Pressable>
				<Pressable onPress={openAddForm} style={styles.addButton}>
					<Text style={styles.addButtonText}>+ Add Item</Text>
				</Pressable>
			</View>

			<View style={styles.titleBlock}>
				<Text style={styles.eyebrow}>INVENTORY</Text>
				<Text style={styles.title}>Modify Inventory Stock</Text>
				<Text style={styles.subtitle}>Add, edit, or remove tracked ingredients.</Text>
			</View>

			<ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
				{sortedInventoryItems.length ? sortedInventoryItems.map((item) => (
					<View key={item.id} style={styles.card}>
						<View style={styles.cardTop}>
							<View style={styles.cardNameBlock}>
								<Text style={styles.cardName}>{item.name}</Text>
								<Text style={styles.cardMeta}>
									{formatStockQuantity(item.quantity, item.unit)} on hand · restock at {formatStockQuantity(item.reorderPoint, item.unit)} · +{formatStockQuantity(item.restockAmount, item.unit)} per restock
								</Text>
							</View>
						</View>
						<View style={styles.cardActions}>
							<Pressable onPress={() => openEditForm(item)} style={styles.editButton}>
								<Text style={styles.editButtonText}>Edit</Text>
							</Pressable>
							<Pressable onPress={() => setConfirmDeleteId(item.id)} style={styles.deleteButton}>
								<Text style={styles.deleteButtonText}>Delete</Text>
							</Pressable>
						</View>
					</View>
				)) : (
					<Text style={styles.emptyState}>No ingredients tracked yet. Tap "+ Add Item" to create one.</Text>
				)}
			</ScrollView>

			{/* Add / edit form */}
			<Modal animationType="slide" transparent visible={formVisible} onRequestClose={closeForm}>
				<View style={styles.modalBackdrop}>
					<View style={styles.formSheet}>
						<View style={styles.formHeader}>
							<Text style={styles.formTitle}>{editingId ? 'Edit ingredient' : 'Add ingredient'}</Text>
							<Pressable onPress={closeForm} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>X</Text>
							</Pressable>
						</View>

						<ScrollView showsVerticalScrollIndicator={false}>
							<Text style={styles.fieldLabel}>NAME</Text>
							<TextInput
								onChangeText={(value) => updateField('name', value)}
								placeholder="e.g. Espresso beans"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.name}
							/>

							<Text style={styles.fieldLabel}>UNIT</Text>
							<TextInput
								onChangeText={(value) => updateField('unit', value)}
								placeholder="e.g. kg, ml, pcs"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.unit}
							/>

							<Text style={styles.fieldLabel}>QUANTITY ON HAND</Text>
							<TextInput
								keyboardType="numeric"
								onChangeText={(value) => updateField('quantity', value)}
								placeholder="0"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.quantity}
							/>

							<Text style={styles.fieldLabel}>RESTOCK AT (LOW-STOCK THRESHOLD)</Text>
							<TextInput
								keyboardType="numeric"
								onChangeText={(value) => updateField('reorderPoint', value)}
								placeholder="0"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.reorderPoint}
							/>

							<Text style={styles.fieldLabel}>RESTOCK AMOUNT</Text>
							<TextInput
								keyboardType="numeric"
								onChangeText={(value) => updateField('restockAmount', value)}
								placeholder="0"
								placeholderTextColor={colors.muted}
								style={styles.fieldInput}
								value={form.restockAmount}
							/>

							{formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

							<Pressable onPress={saveForm} style={styles.saveButton}>
								<Text style={styles.saveButtonText}>{editingId ? 'SAVE CHANGES' : 'ADD INGREDIENT'}</Text>
							</Pressable>
						</ScrollView>
					</View>
				</View>
			</Modal>

			{/* Delete confirmation */}
			<Modal animationType="fade" transparent visible={Boolean(confirmDeleteId)} onRequestClose={() => setConfirmDeleteId(null)}>
				<View style={styles.confirmBackdrop}>
					<View style={styles.confirmCard}>
						<Text style={styles.confirmTitle}>Remove this ingredient?</Text>
						<Text style={styles.confirmBody}>This can't be undone. Menu items that use it will no longer be able to check its stock.</Text>
						<View style={styles.confirmActions}>
							<Pressable onPress={() => setConfirmDeleteId(null)} style={styles.confirmCancel}>
								<Text style={styles.confirmCancelText}>Cancel</Text>
							</Pressable>
							<Pressable onPress={() => confirmDelete(confirmDeleteId)} style={styles.confirmDelete}>
								<Text style={styles.confirmDeleteText}>Delete</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const colors = {
	background: '#FFFFFF',
	ink: '#1F1D1B',
	muted: '#9B958D',
	accent: '#2F6FED',
	border: '#EDEAE5',
	danger: '#C0503F',
	cardBg: '#FDFCFB',
};

function formatStockQuantity(value, unit) {
	const amount = Number.parseFloat(value);
	const rounded = Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
	const formatted = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
	return `${formatted} ${unit}`;
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 18 },
	backButton: { paddingVertical: 8 },
	backButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
	addButton: { backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
	addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
	titleBlock: { paddingHorizontal: 24, paddingTop: 14 },
	eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
	title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
	subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
	list: { padding: 24, paddingTop: 18 },
	emptyState: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 30, textAlign: 'center' },
	card: { backgroundColor: colors.cardBg, borderColor: colors.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, padding: 16 },
	cardTop: { marginBottom: 12 },
	cardNameBlock: { gap: 4 },
	cardName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	cardMeta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
	cardActions: { flexDirection: 'row', gap: 10 },
	editButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 40 },
	editButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
	deleteButton: { alignItems: 'center', borderColor: colors.danger, borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40 },
	deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: '800' },

	modalBackdrop: { backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'flex-end' },
	formSheet: { backgroundColor: colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%', padding: 24, paddingBottom: 34 },
	formHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
	formTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
	closeButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8, marginTop: 14 },
	fieldInput: { backgroundColor: '#F7F6F4', borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
	formErrorText: { color: colors.danger, fontSize: 12, marginTop: 14 },
	saveButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10, justifyContent: 'center', marginTop: 24, minHeight: 50 },
	saveButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

	confirmBackdrop: { alignItems: 'center', backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'center', padding: 32 },
	confirmCard: { backgroundColor: colors.background, borderRadius: 16, maxWidth: 340, padding: 22, width: '100%' },
	confirmTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 8 },
	confirmBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
	confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
	confirmCancel: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
	confirmCancelText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
	confirmDelete: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 44 },
	confirmDeleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});