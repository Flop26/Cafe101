import { useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

const categoryOptions = ['Coffee', 'Meals', 'Snacks', 'Sodas'];

function getOptionType(category) {
	if (category === 'Coffee') return 'coffee';
	if (category === 'Sodas') return 'coldDrink';
	return 'none';
}

const emptyForm = {
	name: '',
	category: 'Coffee',
	description: '',
	price: '',
	imageUri: '',
	ingredients: [{ name: '', amount: '', unit: 'g' }],
};

export default function ModifyMenu() {
	const { menuItems, createMenuItem, updateMenuItem, deleteMenuItem } = useMenu();
	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState(null);
	const [error, setError] = useState('');

	function updateField(field, value) {
		setForm((currentForm) => ({ ...currentForm, [field]: value }));
		setError('');
	}

	function resetForm() {
		setForm(emptyForm);
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
			ingredients: [...currentForm.ingredients, { name: '', amount: '', unit: 'g' }],
		}));
	}

	function removeIngredient(index) {
		setForm((currentForm) => ({
			...currentForm,
			ingredients: currentForm.ingredients.length === 1
				? currentForm.ingredients
				: currentForm.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
		}));
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
				? item.ingredients.map((ingredient) => ({ ...ingredient, amount: String(ingredient.amount) }))
				: [{ name: item.ingredients || '', amount: '', unit: 'g' }],
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

		const itemData = {
			name: form.name.trim(),
			category: form.category,
			description: form.description.trim() || formatIngredients(ingredients),
			price,
			imageUri: form.imageUri.trim(),
			ingredients,
			options: getOptionType(form.category),
			accent: editingId ? menuItems.find((item) => item.id === editingId)?.accent || '#B75E43' : '#B75E43',
		};

		if (editingId) {
			updateMenuItem(editingId, itemData);
		} else {
			createMenuItem({ ...itemData, id: `${form.category.toLowerCase()}-${Date.now()}` });
		}
		resetForm();
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
				<View style={styles.topBar}>
					<View>
						<Text style={styles.eyebrow}>CAFE101 / MENU ADMIN</Text>
						<Text style={styles.title}>Modify menu</Text>
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
					<TextInput onChangeText={(value) => updateField('name', value)} placeholder="Example: Caramel Latte" placeholderTextColor={colors.muted} style={styles.input} value={form.name} />
					<Text style={styles.label}>CATEGORY</Text>
					<View style={styles.categoryRow}>
						{categoryOptions.map((category) => (
							<Pressable key={category} onPress={() => updateField('category', category)} style={[styles.categoryButton, form.category === category && styles.categoryButtonActive]}>
								<Text style={[styles.categoryButtonText, form.category === category && styles.categoryButtonTextActive]}>{category}</Text>
							</Pressable>
						))}
					</View>

					<View style={styles.twoColumns}>
						<View style={styles.columnField}>
							<Text style={styles.label}>PRICE</Text>
							<TextInput keyboardType="decimal-pad" onChangeText={(value) => updateField('price', value)} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} value={form.price} />
						</View>
					</View>

					<Text style={styles.label}>ITEM PICTURE</Text>
					<TextInput onChangeText={(value) => updateField('imageUri', value)} placeholder="Paste an image URL or local image path" placeholderTextColor={colors.muted} style={styles.input} value={form.imageUri} autoCapitalize="none" autoCorrect={false} />
					{form.imageUri ? <Image source={{ uri: form.imageUri }} style={styles.imagePreview} /> : null}

					<View style={styles.ingredientHeader}>
						<Text style={styles.label}>INGREDIENTS PER ITEM</Text>
						<Pressable onPress={addIngredient}><Text style={styles.addIngredientText}>+ ADD INGREDIENT</Text></Pressable>
					</View>
					{form.ingredients.map((ingredient, index) => (
						<View key={`ingredient-${index}`} style={styles.ingredientRow}>
							<TextInput onChangeText={(value) => updateIngredient(index, 'name', value)} placeholder="Milk" placeholderTextColor={colors.muted} style={[styles.input, styles.ingredientName]} value={ingredient.name} />
							<TextInput keyboardType="decimal-pad" onChangeText={(value) => updateIngredient(index, 'amount', value)} placeholder="50" placeholderTextColor={colors.muted} style={[styles.input, styles.ingredientAmount]} value={String(ingredient.amount)} />
							<View style={styles.ingredientUnitRow}>
								{['g', 'mg', 'ml', 'kg', 'L', 'piece'].map((unit) => (
									<Pressable key={unit} onPress={() => updateIngredient(index, 'unit', unit)} style={[styles.ingredientUnit, ingredient.unit === unit && styles.unitButtonActive]}><Text style={[styles.unitText, ingredient.unit === unit && styles.unitTextActive]}>{unit}</Text></Pressable>
								))}
							</View>
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
							<Text style={styles.catalogItemMeta}>{item.category}  /  ₱{item.price.toFixed(2)}</Text>
							<Text style={styles.catalogItemIngredients}>{formatIngredients(item.ingredients)}</Text>
						</View>
						<View style={styles.catalogActions}>
							<Pressable onPress={() => editItem(item)} style={styles.editButton}><Text style={styles.editButtonText}>EDIT</Text></Pressable>
							<Pressable onPress={() => deleteMenuItem(item.id)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>DELETE</Text></Pressable>
						</View>
					</View>
				))}
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

function formatIngredients(ingredients) {
	if (!Array.isArray(ingredients)) return ingredients || '';
	return ingredients.map((ingredient) => `${ingredient.name} ${ingredient.amount} ${ingredient.unit}`).join('  |  ');
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
	twoColumns: { flexDirection: 'row', gap: 14 },
	columnField: { flex: 1 },
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
