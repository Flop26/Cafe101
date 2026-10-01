import { useState } from 'react';
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';
import { getSizeList, getSizePrice, getOptionType } from '../utils/pricing';

const emptyForm = {
	name: '',
	category: '',
	description: '',
	price: '',
	imageUri: '',
	ingredients: [{ name: '', amount: '', unit: 'g', custom: false }],
	sizeIncreases: { Medium: '20', Large: '40' }, // default suggestions (% over base price)
};

export default function ModifyMenu() {
	const { menuItems, inventoryItems = [], categories, createMenuItem, updateMenuItem, deleteMenuItem, createCategory, updateCategory, deleteCategory } = useMenu();
	const categoryOptions = categories.map((c) => c.name);
	const [form, setForm] = useState({ ...emptyForm, category: categoryOptions[0] || '' });
	const [editingId, setEditingId] = useState(null);
	const [error, setError] = useState('');
	const [categoryModalVisible, setCategoryModalVisible] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState('');
	const [newCategorySupportsSize, setNewCategorySupportsSize] = useState(false);
	const [categoryError, setCategoryError] = useState('');
	const [confirmDialog, setConfirmDialog] = useState(null);
	const [deleteModalVisible, setDeleteModalVisible] = useState(false);
	const [categoryToDelete, setCategoryToDelete] = useState(null);
	const [deleteCategoryError, setDeleteCategoryError] = useState('');
	const [ingredientPickerIndex, setIngredientPickerIndex] = useState(null);

	// Sizes above the base size (Medium/Large, or just Large for cold drinks)
	const extraSizes = getSizeList(getOptionType(form.category, categories)).slice(1);
	const basePrice = Number.parseFloat(form.price) || 0;

	const selectedCategory = categories.find((category) => category.name === form.category);
	const sizeIsFixed = form.category === 'Coffee' || form.category === 'Sodas';

	// Turn size options on/off for the currently selected category
	async function toggleCategorySizes(value) {
		if (!selectedCategory) return;
		try {
			await updateCategory(selectedCategory.id, { supportsSize: value });
			setError('');
		} catch {
			setError('Could not update the category. Check the connection and try again.');
		}
	}

	// Generic confirmation dialog (Alert.alert doesn't show buttons on web, so we use a Modal)
	function askConfirm(dialog) {
		setConfirmDialog(dialog);
	}

	function closeConfirm() {
		setConfirmDialog(null);
	}

	function runConfirm() {
		const action = confirmDialog?.onConfirm;
		setConfirmDialog(null);
		if (action) action();
	}

	function openDeleteCategoryModal() {
		setCategoryToDelete(null);
		setDeleteCategoryError('');
		setDeleteModalVisible(true);
	}

	function closeDeleteCategoryModal() {
		setDeleteModalVisible(false);
		setCategoryToDelete(null);
		setDeleteCategoryError('');
	}

	const categoryPendingDelete = categories.find((category) => category.id === categoryToDelete);
	const itemsInPendingCategory = categoryPendingDelete
		? menuItems.filter((item) => item.category === categoryPendingDelete.name).length
		: 0;
	const canDeleteCategory = Boolean(categoryPendingDelete) && itemsInPendingCategory === 0;

	async function confirmDeleteCategory() {
		if (!canDeleteCategory) return;
		const removedName = categoryPendingDelete.name;
		const remaining = categories.filter((category) => category.id !== categoryPendingDelete.id);

		try {
			const result = await deleteCategory(categoryPendingDelete.id);
			if (!result?.deleted) {
				setDeleteCategoryError(result?.message || 'Category could not be deleted.');
				return;
			}
		} catch (deleteError) {
			setDeleteCategoryError(deleteError.message || 'Could not delete category. Check the connection and try again.');
			return;
		}

		if (form.category === removedName) {
			setForm((currentForm) => ({ ...currentForm, category: remaining[0]?.name || '' }));
		}
		setError('');
		closeDeleteCategoryModal();
	}

	function updateField(field, value) {
		setForm((currentForm) => ({ ...currentForm, [field]: value }));
		setError('');
	}

	function updateSizeIncrease(size, value) {
		setForm((f) => ({ ...f, sizeIncreases: { ...f.sizeIncreases, [size]: value } }));
		setError('');
	}

	function resetForm() {
		setForm({ ...emptyForm, category: categoryOptions[0] || '' });
		setEditingId(null);
		setError('');
	}

	function updateIngredient(index, field, value) {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: currentForm.ingredients.map((ingredient, ingredientIndex) => (
				ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
			)),
		}));
		setError('');
	}

	function addIngredient() {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: [...currentForm.ingredients, { name: '', amount: '', unit: 'g', custom: false }],
		}));
	}

	function selectInventoryIngredient(index, item) {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: currentForm.ingredients.map((ingredient, ingredientIndex) => (
				ingredientIndex === index
					? { ...ingredient, name: item.name, unit: item.unit, custom: false }
					: ingredient
			)),
		}));
		setIngredientPickerIndex(null);
		setError('');
	}

	function switchIngredientToCustom(index) {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: currentForm.ingredients.map((ingredient, ingredientIndex) => (
				ingredientIndex === index ? { ...ingredient, custom: true } : ingredient
			)),
		}));
		setIngredientPickerIndex(null);
		setError('');
	}

	function removeIngredient(index) {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: currentForm.ingredients.length === 1
				? currentForm.ingredients
				: currentForm.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
		}));
	}

	function closeCategoryModal() {
		setCategoryModalVisible(false);
		setNewCategoryName('');
		setNewCategorySupportsSize(false);
		setCategoryError('');
	}

	async function addCategory() {
		const name = newCategoryName.trim();
		if (!name) {
			setCategoryError('Enter a category name.');
			return;
		}
		if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
			setCategoryError('That category already exists.');
			return;
		}

		try {
			await createCategory({ name, supportsSize: newCategorySupportsSize });
		} catch {
			setCategoryError('Could not create category. Check the connection and try again.');
			return;
		}
		setForm((currentForm) => ({ ...currentForm, category: name }));
		closeCategoryModal();
	}

	function editItem(item) {
		setEditingId(item.id);
		setForm({
			name: item.name,
			category: item.category,
			description: item.description,
			price: String(item.price),
			imageUri: item.imageUri || '',
			ingredients: Array.isArray(item.ingredients)
				? item.ingredients.map((ingredient) => ({
					...ingredient,
					amount: String(ingredient.amount),
					custom: !inventoryItems.some((inventoryItem) => sameIngredient(ingredient, inventoryItem)),
				}))
				: [{ name: item.ingredients || '', amount: '', unit: 'g', custom: true }],
			sizeIncreases: {
				Medium: String(item.sizeIncreases?.Medium ?? 0),
				Large: String(item.sizeIncreases?.Large ?? 0),
			},
		});
		setError('');
	}

	function saveItem() {
		const price = Number.parseFloat(form.price);
		const ingredients = form.ingredients.map((ingredient) => ({
			name: ingredient.name.trim(),
			amount: Number.parseFloat(ingredient.amount),
			unit: ingredient.unit,
		}));
		if (!form.name.trim() || !ingredients.length || ingredients.some((ingredient) => !ingredient.name || !ingredient.amount || ingredient.amount < 0 || !ingredient.unit) || !price) {
			setError('Name, price, and complete ingredients are required.');
			return;
		}

		const sizeIncreases = {};
		for (const size of extraSizes) {
			const percent = Number.parseFloat(form.sizeIncreases[size]);
			if (!Number.isFinite(percent) || percent < 0) {
				setError(`Enter a valid % increase for ${size}.`);
				return;
			}
			sizeIncreases[size] = percent;
		}

		const itemData = {
			name: form.name.trim(),
			category: form.category,
			description: form.description.trim() || formatIngredients(ingredients),
			price,
			sizeIncreases,
			imageUri: form.imageUri.trim(),
			ingredients,
			options: getOptionType(form.category, categories),
			accent: editingId ? menuItems.find((item) => item.id === editingId)?.accent || '#B75E43' : '#B75E43',
		};

		if (editingId) {
			askConfirm({
				title: 'Update this item?',
				message: `This overwrites the saved details of "${itemData.name}" (price, sizes, ingredients, category). Orders already placed are not changed.`,
				confirmText: 'UPDATE',
				onConfirm: () => {
					updateMenuItem(editingId, itemData);
					resetForm();
				},
			});
			return;
		}

		createMenuItem({ ...itemData, id: `${form.category.toLowerCase()}-${Date.now()}` });
		resetForm();
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
				<View style={styles.topBar}>
					<View>
						<Text style={styles.title}>Modify Menu</Text>
					</View>
					<Pressable accessibilityLabel="Close menu administration" onPress={() => router.back()} style={styles.closeButton}>
						<Text style={styles.closeButtonText}>X</Text>
					</Pressable>
				</View>

				<View style={styles.formPanel}>
					<View style={styles.formHeader}>
						<View>
							<Text style={styles.sectionLabel}>{editingId ? 'EDIT ITEM' : 'NEW ITEM'}</Text>
							<Text style={styles.formTitle}>{editingId ? 'Update menu item' : 'Add to the menu'}</Text>
						</View>
						{editingId ? <Pressable onPress={resetForm}><Text style={styles.cancelText}>CANCEL</Text></Pressable> : null}
					</View>

					<Text style={styles.label}>ITEM NAME</Text>
					<TextInput onChangeText={(value) => updateField('name', value)} placeholder="Add new item..." placeholderTextColor={colors.muted} style={styles.input} value={form.name} />
					<Text style={styles.label}>CATEGORY</Text>
					<View style={styles.categoryRow}>
						{categoryOptions.map((category) => (
							<Pressable key={category} onPress={() => updateField('category', category)} style={[styles.categoryButton, form.category === category && styles.categoryButtonActive]}>
								<Text style={[styles.categoryButtonText, form.category === category && styles.categoryButtonTextActive]}>{category}</Text>
							</Pressable>
						))}
						<Pressable accessibilityRole="button" onPress={() => { setCategoryError(''); setCategoryModalVisible(true); }} style={styles.addCategoryButton}>
							<Text style={styles.addCategoryButtonText}>+ ADD CATEGORY</Text>
						</Pressable>
						<Pressable accessibilityRole="button" onPress={openDeleteCategoryModal} style={styles.deleteCategoryButton}>
							<Text style={styles.deleteCategoryText}>- DELETE CATEGORY</Text>
						</Pressable>
					</View>

					{selectedCategory && !sizeIsFixed ? (
						<View style={styles.sizeSettingRow}>
							<View style={styles.sizeSettingCopy}>
								<Text style={styles.sizeSettingTitle}>Offer size options for "{selectedCategory.name}"</Text>
								<Text style={styles.sizeSettingHint}>Items in this category can be ordered Small, Medium, or Large.</Text>
							</View>
							<Switch
								accessibilityLabel="Offer size options for this category"
								onValueChange={toggleCategorySizes}
								thumbColor={selectedCategory.supportsSize ? colors.terracotta : '#FFFFFF'}
								trackColor={{ false: colors.border, true: '#D8B9A9' }}
								value={Boolean(selectedCategory.supportsSize)}
							/>
						</View>
					) : null}

					<View style={styles.twoColumns}>
						<View style={styles.columnField}>
							<Text style={styles.label}>{extraSizes.length ? 'BASE PRICE (SMALLEST SIZE)' : 'PRICE'}</Text>
							<TextInput keyboardType="decimal-pad" onChangeText={(value) => updateField('price', value)} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} value={form.price} />
						</View>
					</View>

					{extraSizes.length ? (
						<>
							<Text style={styles.label}>PRICE INCREASE PER SIZE</Text>
							{extraSizes.map((size) => {
								const percent = Number.parseFloat(form.sizeIncreases[size]) || 0;
								return (
									<View key={size} style={styles.sizePriceRow}>
										<Text style={styles.sizePriceName}>{size}  +</Text>
										<TextInput keyboardType="decimal-pad" onChangeText={(v) => updateSizeIncrease(size, v)} style={[styles.input, styles.sizePriceInput]} value={form.sizeIncreases[size]} />
										<Text style={styles.sizePriceName}>%</Text>
										<Text style={styles.sizePricePreview}>= ₱{getSizePrice(basePrice, percent).toFixed(2)}</Text>
									</View>
								);
							})}
						</>
					) : null}

					<Text style={styles.label}>ITEM PICTURE</Text>
					<TextInput onChangeText={(value) => updateField('imageUri', value)} placeholder="Paste an image URL or local image path" placeholderTextColor={colors.muted} style={styles.input} value={form.imageUri} autoCapitalize="none" autoCorrect={false} />
					{form.imageUri ? <Image source={{ uri: form.imageUri }} style={styles.imagePreview} /> : null}

					<View style={styles.ingredientHeader}>
						<Text style={styles.label}>INGREDIENTS PER ITEM</Text>
						<Pressable onPress={addIngredient}><Text style={styles.addIngredientText}>+ ADD INGREDIENT</Text></Pressable>
					</View>
					{form.ingredients.map((ingredient, index) => (
						<View key={`ingredient-${index}`} style={styles.ingredientRow}>
							{ingredient.custom ? (
								<TextInput onChangeText={(value) => updateIngredient(index, 'name', value)} placeholder="New ingredient name" placeholderTextColor={colors.muted} style={[styles.input, styles.ingredientName]} value={ingredient.name} />
							) : (
								<Pressable onPress={() => setIngredientPickerIndex(index)} style={[styles.ingredientPickerButton, styles.ingredientName]}>
									<Text numberOfLines={1} style={styles.ingredientPickerName}>{ingredient.name || 'Choose from inventory'}</Text>
									<Text style={styles.ingredientPickerStock}>
										{inventoryItems.find((item) => sameIngredient(ingredient, item))?.quantity ?? 0} {ingredient.unit} in stock
									</Text>
								</Pressable>
							)}
							<TextInput keyboardType="decimal-pad" onChangeText={(value) => updateIngredient(index, 'amount', value)} placeholder="50" placeholderTextColor={colors.muted} style={[styles.input, styles.ingredientAmount]} value={String(ingredient.amount)} />
							{ingredient.custom ? (
								<View style={styles.ingredientUnitRow}>
									{['g', 'mg', 'ml', 'kg', 'L', 'piece'].map((unit) => (
										<Pressable key={unit} onPress={() => updateIngredient(index, 'unit', unit)} style={[styles.ingredientUnit, ingredient.unit === unit && styles.unitButtonActive]}><Text style={[styles.unitText, ingredient.unit === unit && styles.unitTextActive]}>{unit}</Text></Pressable>
									))}
								</View>
							) : null}
							<Pressable accessibilityLabel="Remove ingredient" onPress={() => removeIngredient(index)} style={styles.removeIngredient}><Text style={styles.removeIngredientText}>X</Text></Pressable>
						</View>
					))}

					<Text style={styles.label}>SHORT DESCRIPTION</Text>
					<TextInput onChangeText={(value) => updateField('description', value)} placeholder="Shown on the order menu" placeholderTextColor={colors.muted} style={styles.input} value={form.description} />

					{error ? <Text style={styles.error}>{error}</Text> : null}
					<Pressable onPress={saveItem} style={styles.saveButton}><Text style={styles.saveButtonText}>{editingId ? 'SAVE ITEM CHANGES' : 'CREATE MENU ITEM'}</Text></Pressable>
				</View>

				<View style={styles.catalogHeader}>
					<View>
						<Text style={styles.sectionLabel}>CURRENT CATALOG</Text>
						<Text style={styles.catalogTitle}>{menuItems.length} menu items</Text>
					</View>
				</View>

				{menuItems.map((item) => (
					<View key={item.id} style={styles.catalogItem}>
						<View style={styles.catalogItemInfo}>
							<Text style={styles.catalogItemName}>{item.name}</Text>
							<Text style={styles.catalogItemMeta}>{item.availability === false ? 'ARCHIVED FROM POS' : `${item.category}  /  ₱${item.price.toFixed(2)}`}</Text>
							<Text style={styles.catalogItemIngredients}>{formatIngredients(item.ingredients)}</Text>
						</View>
						<View style={styles.catalogActions}>
							<Pressable onPress={() => editItem(item)} style={styles.editButton}><Text style={styles.editButtonText}>EDIT</Text></Pressable>
							<Pressable
								onPress={() => askConfirm({
									title: 'Delete this item?',
									message: `"${item.name}" will be removed from the POS. Items with order history are archived so past receipts remain intact.`,
									confirmText: 'DELETE',
									destructive: true,
										onConfirm: async () => {
										try {
											await deleteMenuItem(item.id);
											if (editingId === item.id) resetForm();
										} catch (deleteError) {
											setError(deleteError.message || 'Could not delete menu item. Check the connection and try again.');
										}
									},
								})}
								style={styles.deleteButton}
							><Text style={styles.deleteButtonText}>DELETE</Text></Pressable>
						</View>
					</View>
				))}
			</ScrollView>
			<Modal animationType="fade" onRequestClose={() => setIngredientPickerIndex(null)} transparent visible={ingredientPickerIndex !== null}>
				<View style={styles.modalBackdrop}>
					<View style={[styles.categoryModal, styles.ingredientPickerModal]}>
						<Text style={styles.sectionLabel}>CURRENT INVENTORY</Text>
						<Text style={styles.formTitle}>Choose an ingredient</Text>
						<Pressable onPress={() => switchIngredientToCustom(ingredientPickerIndex)} style={styles.customIngredientOption}>
							<Text style={styles.customIngredientText}>+ Enter a new ingredient manually</Text>
						</Pressable>
						<ScrollView style={styles.ingredientInventoryList}>
							{inventoryItems.length ? inventoryItems.map((item) => (
								<Pressable key={item.id} onPress={() => selectInventoryIngredient(ingredientPickerIndex, item)} style={styles.ingredientInventoryOption}>
									<Text style={styles.ingredientInventoryName}>{item.name}</Text>
									<Text style={styles.ingredientInventoryStock}>{item.quantity} {item.unit} in stock</Text>
								</Pressable>
							)) : <Text style={styles.sizeSettingHint}>Inventory is empty. Add a custom ingredient instead.</Text>}
						</ScrollView>
						<View style={styles.modalActions}>
							<Pressable onPress={() => setIngredientPickerIndex(null)} style={styles.modalCancelButton}>
								<Text style={styles.modalCancelText}>CANCEL</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
			<Modal animationType="fade" onRequestClose={closeCategoryModal} transparent visible={categoryModalVisible}>
				<View style={styles.modalBackdrop}>
					<View style={styles.categoryModal}>
						<Text style={styles.sectionLabel}>NEW CATEGORY</Text>
						<Text style={styles.formTitle}>Add a category</Text>
						<TextInput
							autoCapitalize="words"
							autoFocus
							onChangeText={(value) => { setNewCategoryName(value); setCategoryError(''); }}
							onSubmitEditing={addCategory}
							placeholder="Category name"
							placeholderTextColor={colors.muted}
							returnKeyType="done"
							style={[styles.input, styles.categoryInput]}
							value={newCategoryName}
						/>
						<View style={styles.sizeSettingRow}>
							<View style={styles.sizeSettingCopy}>
								<Text style={styles.sizeSettingTitle}>Offer size options</Text>
								<Text style={styles.sizeSettingHint}>Items in this category can be ordered Small, Medium, or Large.</Text>
							</View>
							<Switch
								accessibilityLabel="Offer size options for this category"
								onValueChange={setNewCategorySupportsSize}
								thumbColor={newCategorySupportsSize ? colors.terracotta : '#FFFFFF'}
								trackColor={{ false: colors.border, true: '#D8B9A9' }}
								value={newCategorySupportsSize}
							/>
						</View>
						{categoryError ? <Text style={styles.error}>{categoryError}</Text> : null}
						<View style={styles.modalActions}>
							<Pressable onPress={closeCategoryModal} style={styles.modalCancelButton}>
								<Text style={styles.modalCancelText}>CANCEL</Text>
							</Pressable>
							<Pressable onPress={addCategory} style={styles.modalSaveButton}>
								<Text style={styles.saveButtonText}>ADD CATEGORY</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
			<Modal animationType="fade" onRequestClose={closeDeleteCategoryModal} transparent visible={deleteModalVisible}>
				<View style={styles.modalBackdrop}>
					<View style={styles.categoryModal}>
						<Text style={styles.sectionLabel}>WARNING</Text>
						<Text style={styles.formTitle}>Delete a category</Text>
						<View style={styles.warningBox}>
							<Text style={styles.warningText}>Deleting a category is permanent and can't be undone. A category that still has menu items can't be deleted. Delete or move those items first.</Text>
						</View>

						<Text style={styles.label}>SELECT CATEGORY TO REMOVE</Text>
						<ScrollView style={styles.deleteList} showsVerticalScrollIndicator={false}>
							{categories.length ? categories.map((category) => {
								const count = menuItems.filter((item) => item.category === category.name).length;
								const active = categoryToDelete === category.id;
								return (
									<Pressable key={category.id} onPress={() => { setCategoryToDelete(category.id); setDeleteCategoryError(''); }} style={[styles.deleteOption, active && styles.deleteOptionActive]}>
										<View style={[styles.radio, active && styles.radioActive]} />
										<Text style={styles.deleteOptionName}>{category.name}</Text>
										<Text style={styles.deleteOptionMeta}>{count} item{count === 1 ? '' : 's'}</Text>
									</Pressable>
								);
							}) : <Text style={styles.sizeSettingHint}>No categories to delete.</Text>}
						</ScrollView>

						{deleteCategoryError ? <Text style={styles.error}>{deleteCategoryError}</Text> : null}
						{categoryPendingDelete && itemsInPendingCategory > 0 ? (
							<Text style={styles.error}>"{categoryPendingDelete.name}" still has {itemsInPendingCategory} menu item{itemsInPendingCategory === 1 ? '' : 's'}. Delete or move them first.</Text>
						) : null}

						<View style={styles.modalActions}>
							<Pressable onPress={closeDeleteCategoryModal} style={styles.modalCancelButton}>
								<Text style={styles.modalCancelText}>CANCEL</Text>
							</Pressable>
							<Pressable disabled={!canDeleteCategory} onPress={confirmDeleteCategory} style={[styles.modalSaveButton, styles.modalDangerButton, !canDeleteCategory && styles.modalDisabledButton]}>
								<Text style={styles.saveButtonText}>DELETE CATEGORY</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			<Modal animationType="fade" onRequestClose={closeConfirm} transparent visible={Boolean(confirmDialog)}>
				<View style={styles.modalBackdrop}>
					<View style={styles.categoryModal}>
						<Text style={styles.sectionLabel}>{confirmDialog?.destructive ? 'WARNING' : 'PLEASE CONFIRM'}</Text>
						<Text style={styles.formTitle}>{confirmDialog?.title}</Text>
						<Text style={styles.confirmMessage}>{confirmDialog?.message}</Text>
						<View style={styles.modalActions}>
							<Pressable onPress={closeConfirm} style={styles.modalCancelButton}>
								<Text style={styles.modalCancelText}>CANCEL</Text>
							</Pressable>
							<Pressable onPress={runConfirm} style={[styles.modalSaveButton, confirmDialog?.destructive && styles.modalDangerButton]}>
								<Text style={styles.saveButtonText}>{confirmDialog?.confirmText || 'CONFIRM'}</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
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

function formatIngredients(ingredients) {
	if (!Array.isArray(ingredients)) return ingredients || '';
	return ingredients.map((ingredient) => `${ingredient.name} ${ingredient.amount} ${ingredient.unit}`).join('  |  ');
}

function sameIngredient(left, right) {
	return String(left.name).trim().toLowerCase() === String(right.name).trim().toLowerCase()
		&& String(left.unit).trim().toLowerCase() === String(right.unit).trim().toLowerCase();
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	content: { padding: 24, paddingBottom: 48 },
	topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
	eyebrow: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1.7, marginBottom: 8 },
	title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 17, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
	closeButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	formPanel: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 9, borderWidth: 1, padding: 18 },
	formHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
	sectionLabel: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
	formTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	cancelText: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
	label: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8, marginTop: 16 },
	input: { borderBottomColor: colors.border, borderBottomWidth: 1, color: colors.ink, fontSize: 14, paddingBottom: 10, paddingHorizontal: 0, paddingTop: 0 },
	categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
	categoryButton: { borderColor: colors.border, borderRadius: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
	categoryButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
	categoryButtonText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
	categoryButtonTextActive: { color: '#FFF9F1' },
	addCategoryButton: { borderColor: colors.terracotta, borderRadius: 5, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 9 },
	addCategoryButtonText: { color: colors.terracotta, fontSize: 10, fontWeight: '800' },
	modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(37, 23, 14, 0.45)', flex: 1, justifyContent: 'center', padding: 24 },
	categoryModal: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 9, borderWidth: 1, maxWidth: 420, padding: 22, width: '100%' },
	categoryInput: { marginTop: 18 },
	sizeSettingRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 14, justifyContent: 'space-between', paddingVertical: 16 },
	sizeSettingCopy: { flex: 1 },
	sizeSettingTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
	sizeSettingHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
	modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 22 },
	modalCancelButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 5, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
	modalCancelText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
	modalSaveButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 5, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
	deleteCategoryButton: { borderColor: '#A33F32', borderRadius: 5, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 9 },
	deleteCategoryText: { color: '#A33F32', fontSize: 10, fontWeight: '800' },
	warningBox: { backgroundColor: '#FBEDEA', borderColor: '#E7C3BB', borderRadius: 6, borderWidth: 1, marginTop: 14, padding: 12 },
	warningText: { color: '#A33F32', fontSize: 12, lineHeight: 18 },
	deleteList: { maxHeight: 220 },
	ingredientPickerModal: { maxHeight: '80%' },
	ingredientInventoryList: { marginTop: 12 },
	ingredientInventoryOption: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 48, paddingVertical: 9 },
	ingredientInventoryName: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '700' },
	ingredientInventoryStock: { color: colors.muted, fontSize: 12 },
	customIngredientOption: { backgroundColor: colors.background, borderRadius: 5, marginTop: 16, padding: 12 },
	customIngredientText: { color: colors.terracotta, fontSize: 13, fontWeight: '800' },
	ingredientPickerButton: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: 1, justifyContent: 'center', minHeight: 36, paddingBottom: 5 },
	ingredientPickerName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
	ingredientPickerStock: { color: colors.muted, fontSize: 10, marginTop: 2 },
	deleteOption: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 6, padding: 12 },
	deleteOptionActive: { backgroundColor: '#FBEDEA', borderColor: '#A33F32' },
	deleteOptionName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '700' },
	deleteOptionMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
	radio: { borderColor: colors.muted, borderRadius: 8, borderWidth: 2, height: 16, width: 16 },
	radioActive: { backgroundColor: '#A33F32', borderColor: '#A33F32' },
	modalDisabledButton: { opacity: 0.4 },
	confirmMessage: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
	modalDangerButton: { backgroundColor: '#A33F32' },
	twoColumns: { flexDirection: 'row', gap: 14 },
	columnField: { flex: 1 },
	sizePriceRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 },
	sizePriceName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
	sizePriceInput: { textAlign: 'center', width: 60 },
	sizePricePreview: { color: colors.terracotta, fontSize: 13, fontWeight: '800', marginLeft: 'auto' },
	imagePreview: { borderRadius: 7, height: 120, marginTop: 12, width: 120 },
	ingredientHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	addIngredientText: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 16 },
	ingredientRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
	ingredientName: { flex: 1, minWidth: 110 },
	ingredientAmount: { width: 55 },
	ingredientUnitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, maxWidth: 150 },
	ingredientUnit: { borderColor: colors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 6 },
	removeIngredient: { alignItems: 'center', height: 25, justifyContent: 'center', width: 20 },
	removeIngredientText: { color: colors.terracotta, fontSize: 12, fontWeight: '800' },
	unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
	unitButton: { borderColor: colors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 7 },
	unitButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
	unitText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
	unitTextActive: { color: '#FFF9F1' },
	multilineInput: { minHeight: 58, textAlignVertical: 'top' },
	error: { color: '#A33F32', fontSize: 12, marginTop: 14 },
	saveButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, justifyContent: 'center', marginTop: 20, minHeight: 50 },
	saveButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
	catalogHeader: { marginTop: 34 },
	catalogTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
	catalogItem: { alignItems: 'center', backgroundColor: colors.panel, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 17 },
	catalogItemInfo: { flex: 1, paddingRight: 10 },
	catalogItemName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	catalogItemMeta: { color: colors.terracotta, fontSize: 10, fontWeight: '800', marginTop: 5 },
	catalogItemIngredients: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
	catalogActions: { alignItems: 'flex-end', gap: 8 },
	editButton: { borderColor: colors.border, borderRadius: 4, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
	editButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
	deleteButton: { paddingHorizontal: 10, paddingVertical: 4 },
	deleteButtonText: { color: colors.terracotta, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});