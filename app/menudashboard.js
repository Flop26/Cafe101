import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

const categories = ['All items', 'Coffee', 'Meals', 'Snacks', 'Sodas'];
const navItems = [
	{ key: 'home', label: 'Home Page' },
	{ key: 'inventory', label: 'Inventory' },
	{ key: 'modifyItems', label: 'Modify Items' },
	{ key: 'salesReport', label: 'View Sales Report' },
];

export default function MenuDashboard() {
	const { menuItems, inventoryItems, createPendingOrder, lastCompletedOrder } = useMenu();
	const [activeCategory, setActiveCategory] = useState('All items');
	const [searchQuery, setSearchQuery] = useState('');
	const [cart, setCart] = useState({});
	const [notes, setNotes] = useState({});
	const [customizations, setCustomizations] = useState({});
	const [selectedItemId, setSelectedItemId] = useState(null);
	const [editNote, setEditNote] = useState('');
	const [editCustomization, setEditCustomization] = useState({});
	const [staffPanel, setStaffPanel] = useState(null);
	const [orderMessage, setOrderMessage] = useState('');
	const [orderMessageType, setOrderMessageType] = useState('success');

	const visibleItems = useMemo(() => {
		const byCategory = activeCategory === 'All items'
			? menuItems
			: menuItems.filter((item) => item.category === activeCategory);
		const query = searchQuery.trim().toLowerCase();
		if (!query) return byCategory;
		return byCategory.filter((item) => item.name.toLowerCase().includes(query));
	}, [activeCategory, menuItems, searchQuery]);

	const inventoryById = useMemo(
		() => inventoryItems.reduce((lookup, item) => ({ ...lookup, [item.id]: item }), {}),
		[inventoryItems],
	);
	const sortedInventoryItems = useMemo(
		() => [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)),
		[inventoryItems],
	);

	const orderItems = menuItems.filter((item) => cart[item.id]);
	const itemCount = orderItems.reduce((total, item) => total + cart[item.id], 0);
	const subtotal = orderItems.reduce((total, item) => total + item.price * cart[item.id], 0);

	useEffect(() => {
		if (!lastCompletedOrder) return;

		setCart({});
		setNotes({});
		setCustomizations({});
		setSelectedItemId(null);
		setOrderMessageType('success');
		setOrderMessage(`${lastCompletedOrder.orderNumber} paid by ${formatPaymentMethod(lastCompletedOrder.paymentMethod)}. Inventory updated.`);
	}, [lastCompletedOrder?.id]);

	function changeQuantity(itemId, change) {
		setOrderMessage('');
		setCart((currentCart) => {
			const nextQuantity = (currentCart[itemId] || 0) + change;
			const nextCart = { ...currentCart };

			if (nextQuantity <= 0) {
				delete nextCart[itemId];
			} else {
				nextCart[itemId] = nextQuantity;
			}

			return nextCart;
		});
	}

	function canMakeItem(item, quantity = 1) {
		if (!Array.isArray(item.ingredients)) return true;

		return item.ingredients.every((ingredient) => {
			const amount = Number.parseFloat(ingredient.amount);
			if (!ingredient.name || !ingredient.unit || !Number.isFinite(amount) || amount <= 0) return true;

			const stockItem = inventoryById[getInventoryKey(ingredient.name, ingredient.unit)];
			return stockItem && stockItem.quantity >= amount * quantity;
		});
	}

	function handleReviewOrder() {
		if (!itemCount) return;

		const result = createPendingOrder({ cart, notes, customizations });

		if (!result.created) {
			setOrderMessageType('error');
			setOrderMessage(result.missing
				? `Not enough stock: ${result.missing.map(formatMissingIngredient).join(', ')}.`
				: result.message);
			return;
		}

		setOrderMessage('');
		router.push('/ordersummary');
	}

	function openItemEditor(itemId) {
		const item = menuItems.find((menuItem) => menuItem.id === itemId);
		const savedCustomization = customizations[itemId] || getDefaultCustomization(item);

		setSelectedItemId(itemId);
		setEditNote(notes[itemId] || '');
		setEditCustomization(savedCustomization);
	}

	function closeItemEditor() {
		setSelectedItemId(null);
		setEditNote('');
		setEditCustomization({});
	}

	function saveItemChanges() {
		if (!selectedItemId) return;

		setNotes((currentNotes) => ({ ...currentNotes, [selectedItemId]: editNote.trim() }));
		setCustomizations((currentCustomizations) => ({
			...currentCustomizations,
			[selectedItemId]: editCustomization,
		}));
		closeItemEditor();
	}

	function removeSelectedItem() {
		if (!selectedItemId) return;

		setCart((currentCart) => {
			const nextCart = { ...currentCart };
			delete nextCart[selectedItemId];
			return nextCart;
		});
		setNotes((currentNotes) => {
			const nextNotes = { ...currentNotes };
			delete nextNotes[selectedItemId];
			return nextNotes;
		});
		setCustomizations((currentCustomizations) => {
			const nextCustomizations = { ...currentCustomizations };
			delete nextCustomizations[selectedItemId];
			return nextCustomizations;
		});
		closeItemEditor();
	}

	const selectedItem = menuItems.find((item) => item.id === selectedItemId);
	const canAddSelectedItem = selectedItem ? canMakeItem(selectedItem, (cart[selectedItem.id] || 0) + 1) : false;

	function updateCustomization(key, value) {
		setEditCustomization((currentCustomization) => ({ ...currentCustomization, [key]: value }));
	}

	// Quick inline size selector for coffee/cold-drink items directly on the grid card,
	// without opening the full editor modal.
	function quickSetSize(item, size) {
		setCustomizations((current) => ({
			...current,
			[item.id]: { ...(current[item.id] || getDefaultCustomization(item)), size },
		}));
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.shell}>
				{/* Left navigation rail */}
				<View style={styles.sidebar}>
					<Text style={styles.brand}>Cafe101</Text>
					<View style={styles.navList}>
						{navItems.map((nav) => (
							<Pressable
								key={nav.key}
								onPress={() => {
									if (nav.key === 'inventory') setStaffPanel('inventory');
									else if (nav.key === 'modifyItems') router.push('/modifymenu');
									else if (nav.key === 'salesReport') setStaffPanel('sales');
								}}
								style={[styles.navItem, nav.key === 'home' && styles.navItemActive]}
							>
								<View style={[styles.navDot, nav.key === 'home' && styles.navDotActive]} />
								<Text style={[styles.navText, nav.key === 'home' && styles.navTextActive]}>{nav.label}</Text>
							</Pressable>
						))}
					</View>
					<Pressable
						onPress={() => { setCart({}); setNotes({}); setCustomizations({}); setOrderMessage(''); }}
						style={styles.resetButton}
					>
						<Text style={styles.resetButtonText}>Reset Order</Text>
					</Pressable>
					<Pressable onPress={() => router.replace('/login')} style={styles.logoutButton}>
						<Text style={styles.logoutButtonText}>Logout</Text>
					</Pressable>
				</View>

				{/* Main menu column */}
				<ScrollView style={styles.mainPanel} contentContainerStyle={styles.mainContent} showsVerticalScrollIndicator={false}>
					<TextInput
						onChangeText={setSearchQuery}
						placeholder="Search..."
						placeholderTextColor={colors.muted}
						style={styles.searchInput}
						value={searchQuery}
					/>

					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
						{categories.map((category) => (
							<Pressable
								key={category}
								onPress={() => setActiveCategory(category)}
								style={[styles.categoryChip, activeCategory === category && styles.categoryChipActive]}
							>
								<Text style={[styles.categoryText, activeCategory === category && styles.categoryTextActive]}>{category}</Text>
							</Pressable>
						))}
					</ScrollView>

					<Text style={styles.menuTitle}>{activeCategory === 'All items' ? 'Full menu' : `${activeCategory} menu`}</Text>

					<View style={styles.menuGrid}>
						{visibleItems.map((item) => {
							const canAddItem = canMakeItem(item, (cart[item.id] || 0) + 1);
							const hasAnyStock = canMakeItem(item);
							const hasSizes = item.options === 'coffee' || item.options === 'coldDrink';
							const sizeOptions = item.options === 'coffee' ? ['S', 'M', 'L'] : item.options === 'coldDrink' ? ['R', 'L'] : [];
							const activeSize = (customizations[item.id] || getDefaultCustomization(item)).size;

							return (
								<Pressable key={item.id} onPress={() => openItemEditor(item.id)} style={styles.menuCard}>
									{item.imageUri ? (
										<Image source={{ uri: item.imageUri }} style={styles.itemImage} />
									) : (
										<View style={[styles.itemIcon, { backgroundColor: item.accent }]}>
											<Text style={styles.itemIconText}>{item.name.charAt(0)}</Text>
										</View>
									)}
									<Text style={styles.itemName}>{item.name}</Text>
									<Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
									{!hasAnyStock ? <Text style={styles.stockHint}>Out of stock</Text> : null}

									<View style={styles.cardRow}>
										<Text style={styles.price}>₱{item.price.toFixed(2)}</Text>
										{hasSizes ? (
											<View style={styles.sizeRow}>
												{sizeOptions.map((size) => {
													const fullSize = size === 'S' ? 'Small' : size === 'M' ? 'Medium' : size === 'L' ? 'Large' : size === 'R' ? 'Regular' : size;
													return (
														<Pressable
															key={size}
															onPress={(event) => { event.stopPropagation(); quickSetSize(item, fullSize); }}
															style={[styles.sizeButton, activeSize === fullSize && styles.sizeButtonActive]}
														>
															<Text style={[styles.sizeText, activeSize === fullSize && styles.sizeTextActive]}>{size}</Text>
														</Pressable>
													);
												})}
											</View>
										) : null}
									</View>

									<View style={styles.ctaRow}>
										<View style={styles.countButtonsWrap}>
											<Pressable
												disabled={!cart[item.id]}
												onPress={(event) => { event.stopPropagation(); changeQuantity(item.id, -1); }}
												style={[styles.countButton, !cart[item.id] && styles.countButtonDisabled]}
											>
												<Text style={styles.countText}>-</Text>
											</Pressable>
											<Text style={styles.countValue}>{cart[item.id] || 0}</Text>
											<Pressable
												disabled={!canAddItem}
												onPress={(event) => { event.stopPropagation(); changeQuantity(item.id, 1); }}
												style={[styles.countButton, !canAddItem && styles.countButtonDisabled]}
											>
												<Text style={styles.countText}>+</Text>
											</Pressable>
										</View>
										<Pressable
											disabled={!canAddItem}
											onPress={(event) => { event.stopPropagation(); changeQuantity(item.id, 1); }}
											style={[styles.addButton, !canAddItem && styles.addButtonDisabled]}
										>
											<Text style={styles.addButtonText}>Add Order + </Text>
										</Pressable>
									</View>
								</Pressable>
							);
						})}
					</View>
				</ScrollView>

				{/* Right cart panel */}
				<View style={styles.cartPanel}>
					<View style={styles.cartHeader}>
						<Text style={styles.cartTitle}>Cart</Text>
						<Text style={styles.cartOrderNumber}>{lastCompletedOrder ? lastCompletedOrder.orderNumber : 'Order #1'}</Text>
					</View>

					<ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
						{orderItems.length ? orderItems.map((item) => {
							const canAddMore = canMakeItem(item, (cart[item.id] || 0) + 1);
							const custom = customizations[item.id];

							return (
								<Pressable key={item.id} onPress={() => openItemEditor(item.id)} style={styles.cartItem}>
									<View style={styles.cartItemTop}>
										<Text style={styles.cartItemName}>{item.name}</Text>
										<Text style={styles.cartItemPrice}>₱{(item.price * cart[item.id]).toFixed(2)}</Text>
									</View>
									{custom?.size ? <Text style={styles.cartItemMeta}>{custom.size}{custom.milk ? ` · ${custom.milk}` : ''}{custom.ice ? ` · ${custom.ice} ice` : ''}</Text> : null}
									{notes[item.id] ? <Text style={styles.cartItemMeta}>Note: {notes[item.id]}</Text> : null}
									<View style={styles.cartQuantityRow}>
										<Pressable onPress={() => changeQuantity(item.id, -1)} style={styles.cartQuantityButton}><Text style={styles.cartQuantityText}>-</Text></Pressable>
										<Text style={styles.cartQuantity}>{cart[item.id]}</Text>
										<Pressable disabled={!canAddMore} onPress={() => changeQuantity(item.id, 1)} style={[styles.cartQuantityButton, !canAddMore && styles.cartQuantityButtonDisabled]}><Text style={styles.cartQuantityText}>+</Text></Pressable>
									</View>
								</Pressable>
							);
						}) : <Text style={styles.emptyOrder}>Tap a menu item to build an order.</Text>}
					</ScrollView>

					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>Total</Text>
						<Text style={styles.total}>₱{subtotal.toFixed(2)}</Text>
					</View>
					{orderMessage ? <Text style={[styles.orderMessage, orderMessageType === 'error' && styles.orderMessageError]}>{orderMessage}</Text> : null}
					<Pressable disabled={!itemCount} onPress={handleReviewOrder} style={[styles.placeOrderButton, !itemCount && styles.placeOrderButtonDisabled]}>
						<Text style={styles.placeOrderText}>{itemCount ? 'Place order' : 'Select items to continue'}</Text>
					</Pressable>
				</View>
			</View>

			<Modal animationType="slide" transparent visible={Boolean(staffPanel)} onRequestClose={() => setStaffPanel(null)}>
				<View style={styles.modalBackdrop}>
					<View style={styles.reportSheet}>
						<View style={styles.editorHeader}>
							<View>
								<Text style={styles.sectionLabel}>{staffPanel === 'inventory' ? 'INVENTORY' : 'SALES REPORT'}</Text>
								<Text style={styles.editorTitle}>{staffPanel === 'inventory' ? 'Stock overview' : "Today's sales"}</Text>
							</View>
							<Pressable onPress={() => setStaffPanel(null)} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>X</Text>
							</Pressable>
						</View>
						{staffPanel === 'inventory' ? (
							<>
								<View style={styles.inventorySummary}>
									<Text style={styles.inventorySummaryValue}>{sortedInventoryItems.length}</Text>
									<Text style={styles.inventorySummaryLabel}>TRACKED INGREDIENTS</Text>
								</View>
								<Pressable
									onPress={() => { setStaffPanel(null); router.push('/modifyinventory'); }}
									style={styles.modifyStockButton}
								>
									<Text style={styles.modifyStockButtonText}>Modify Inventory Stock</Text>
								</Pressable>
								<ScrollView style={styles.reportList} showsVerticalScrollIndicator={false}>
									{sortedInventoryItems.map((item) => {
										const status = getStockStatus(item);

										return (
											<View key={item.id} style={styles.inventoryRow}>
												<View style={styles.inventoryTopRow}>
													<View style={styles.inventoryNameBlock}>
														<Text style={styles.reportName}>{item.name}</Text>
														<Text style={styles.inventoryMeta}>Restock at {formatStockQuantity(item.reorderPoint, item.unit)}</Text>
													</View>
													<Text style={styles.reportQuantity}>{formatStockQuantity(item.quantity, item.unit)}</Text>
												</View>
												<View style={styles.inventoryBottomRow}>
													<Text style={[styles.reportStatus, status === 'Low stock' && styles.lowStock, status === 'Out' && styles.outStock]}>{status}</Text>
												</View>
											</View>
										);
									})}
								</ScrollView>
							</>
						) : (
							<>
								<View style={styles.salesTotal}><Text style={styles.salesTotalLabel}>TODAY'S TOTAL</Text><Text style={styles.salesTotalValue}>₱248.50</Text></View>
								<View style={styles.reportRow}><Text style={styles.reportName}>Orders completed</Text><Text style={styles.reportQuantity}>32</Text></View>
								<View style={styles.reportRow}><Text style={styles.reportName}>Best seller</Text><Text style={styles.reportQuantity}>Caffe Latte</Text></View>
								<Text style={styles.demoReportNote}>Demo report data. Connect sales records later.</Text>
							</>
						)}
					</View>
				</View>
			</Modal>

			<Modal animationType="slide" transparent visible={Boolean(selectedItem)} onRequestClose={closeItemEditor}>
				<View style={styles.modalBackdrop}>
					<View style={styles.editorSheet}>
						<View style={styles.editorHeader}>
							<View>
								<Text style={styles.sectionLabel}>MODIFY ITEM</Text>
								<Text style={styles.editorTitle}>{selectedItem?.name}</Text>
							</View>
							<Pressable accessibilityLabel="Close item editor" onPress={closeItemEditor} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>X</Text>
							</Pressable>
						</View>

						<Text style={styles.editorLabel}>QUANTITY</Text>
						<View style={styles.editorQuantityRow}>
							<Pressable onPress={() => selectedItemId && changeQuantity(selectedItemId, -1)} style={styles.editorQuantityButton}><Text style={styles.editorQuantityText}>-</Text></Pressable>
							<Text style={styles.editorQuantity}>{selectedItemId ? cart[selectedItemId] : 0}</Text>
							<Pressable disabled={!canAddSelectedItem} onPress={() => selectedItemId && changeQuantity(selectedItemId, 1)} style={[styles.editorQuantityButton, !canAddSelectedItem && styles.editorQuantityButtonDisabled]}><Text style={styles.editorQuantityText}>+</Text></Pressable>
						</View>

						{selectedItem?.options === 'coffee' ? (
							<>
								<Text style={styles.editorLabel}>SIZE</Text>
								<View style={styles.optionRow}>
									{['Small', 'Medium', 'Large'].map((size) => (
										<Pressable key={size} onPress={() => updateCustomization('size', size)} style={[styles.optionButton, editCustomization.size === size && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.size === size && styles.optionTextActive]}>{size}</Text>
										</Pressable>
									))}
								</View>
								<Text style={styles.editorLabel}>MILK</Text>
								<View style={styles.optionRow}>
									{['Regular', 'Oat', 'Almond'].map((milk) => (
										<Pressable key={milk} onPress={() => updateCustomization('milk', milk)} style={[styles.optionButton, editCustomization.milk === milk && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.milk === milk && styles.optionTextActive]}>{milk}</Text>
										</Pressable>
									))}
								</View>
							</>
						) : null}

						{selectedItem?.options === 'coldDrink' ? (
							<>
								<Text style={styles.editorLabel}>SIZE</Text>
								<View style={styles.optionRow}>
									{['Regular', 'Large'].map((size) => (
										<Pressable key={size} onPress={() => updateCustomization('size', size)} style={[styles.optionButton, editCustomization.size === size && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.size === size && styles.optionTextActive]}>{size}</Text>
										</Pressable>
									))}
								</View>
								<Text style={styles.editorLabel}>ICE</Text>
								<View style={styles.optionRow}>
									{['Regular', 'Less', 'None'].map((ice) => (
										<Pressable key={ice} onPress={() => updateCustomization('ice', ice)} style={[styles.optionButton, editCustomization.ice === ice && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.ice === ice && styles.optionTextActive]}>{ice}</Text>
										</Pressable>
									))}
								</View>
							</>
						) : null}

						<Text style={styles.editorLabel}>PREPARATION NOTE</Text>
						<TextInput
							multiline
							onChangeText={setEditNote}
							placeholder="Example: extra hot, no sugar..."
							placeholderTextColor={colors.muted}
							style={styles.noteInput}
							value={editNote}
						/>

						<View style={styles.editorActions}>
							<Pressable onPress={removeSelectedItem} style={styles.removeButton}>
								<Text style={styles.removeButtonText}>REMOVE</Text>
							</Pressable>
							<Pressable onPress={saveItemChanges} style={styles.saveButton}>
								<Text style={styles.saveButtonText}>SAVE CHANGES</Text>
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
	panel: '#FFFFFF',
	sidebar: '#FFFFFF',
	chipBorder: '#E4E0DA',
	cartBg: '#FAFAF8',
	cardBg: '#FDFCFB',
};

function getDefaultCustomization(item) {
	if (item?.options === 'coffee') return { size: 'Medium', milk: 'Regular' };
	if (item?.options === 'coldDrink') return { size: 'Regular', ice: 'Regular' };
	return {};
}

function getInventoryKey(name, unit) {
	return `${String(name).trim().toLowerCase()}-${String(unit).trim().toLowerCase()}`;
}

function getStockStatus(item) {
	if (item.quantity <= 0) return 'Out';
	if (item.quantity <= item.reorderPoint) return 'Low stock';
	return 'In stock';
}

function formatStockQuantity(value, unit) {
	const amount = Number.parseFloat(value);
	const rounded = Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
	const formatted = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
	return `${formatted} ${unit}`;
}

function formatMissingIngredient(ingredient) {
	const shortage = Math.max(0, ingredient.amount - ingredient.available);
	return `${ingredient.name} needs ${formatStockQuantity(shortage, ingredient.unit)} more`;
}

function formatPaymentMethod(paymentMethod) {
	if (paymentMethod === 'cashless') return 'Cashless';
	return 'Cash';
}

const styles = StyleSheet.create({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	shell: { flex: 1, flexDirection: 'row' },

	// Sidebar
	sidebar: { backgroundColor: colors.sidebar, borderRightColor: colors.border, borderRightWidth: 1, paddingHorizontal: 18, paddingTop: 26, width: 176 },
	brand: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 30 },
	navList: { gap: 4 },
	navItem: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingVertical: 11 },
	navItemActive: { backgroundColor: '#F1F4FE' },
	navDot: { backgroundColor: '#D8D3CB', borderRadius: 5, height: 9, width: 9 },
	navDotActive: { backgroundColor: colors.accent },
	navText: { color: '#6F6A63', fontSize: 13, fontWeight: '600' },
	navTextActive: { color: colors.ink, fontWeight: '700' },
	resetButton: { backgroundColor: '#F6F4F1', borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginTop: 'auto', paddingHorizontal: 12, paddingVertical: 11 },
	resetButtonText: { color: colors.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' },
	logoutButton: { marginBottom: 24, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8 },
	logoutButtonText: { color: '#C0503F', fontSize: 12, fontWeight: '700', textAlign: 'center' },

	// Main panel
	mainPanel: { flex: 1 },
	mainContent: { padding: 24, paddingBottom: 40 },
	searchInput: { backgroundColor: '#F7F6F4', borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 14, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 12 },
	categoryScroll: { marginBottom: 18 },
	categoryChip: { alignItems: 'center', borderColor: colors.chipBorder, borderRadius: 20, borderWidth: 1, justifyContent: 'center', marginRight: 8, paddingHorizontal: 18, paddingVertical: 10 },
	categoryChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
	categoryText: { color: '#6F6A63', fontSize: 12, fontWeight: '700' },
	categoryTextActive: { color: '#FFFFFF' },
	menuTitle: { color: colors.ink, fontSize: 24, fontWeight: '800', marginBottom: 16 },
	menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
	menuCard: { backgroundColor: colors.cardBg, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 14, width: '47%' },
	itemImage: { borderRadius: 12, height: 96, marginBottom: 10, width: '100%' },
	itemIcon: { alignItems: 'center', borderRadius: 12, height: 96, justifyContent: 'center', marginBottom: 10 },
	itemIconText: { fontSize: 30, fontWeight: '800' },
	itemName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
	itemDescription: { color: colors.muted, fontSize: 11, lineHeight: 15, marginBottom: 8 },
	stockHint: { color: '#C0503F', fontSize: 10, fontWeight: '700', marginBottom: 6 },
	cardRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
	price: { color: colors.ink, fontSize: 14, fontWeight: '800' },
	sizeRow: { flexDirection: 'row', gap: 4 },
	sizeButton: { alignItems: 'center', backgroundColor: '#F1EFEA', borderRadius: 6, height: 22, justifyContent: 'center', width: 22 },
	sizeButtonActive: { backgroundColor: colors.ink },
	sizeText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
	sizeTextActive: { color: '#FFFFFF' },
	ctaRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
	countButtonsWrap: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	countButton: { alignItems: 'center', backgroundColor: '#F1EFEA', borderRadius: 8, height: 26, justifyContent: 'center', width: 26 },
	countButtonDisabled: { opacity: 0.4 },
	countText: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 15 },
	countValue: { color: colors.ink, fontSize: 12, fontWeight: '800', minWidth: 14, textAlign: 'center' },
	addButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 34 },
	addButtonDisabled: { backgroundColor: '#C7C1B8' },
	addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

	// Cart panel
	cartPanel: { backgroundColor: colors.cartBg, borderLeftColor: colors.accent, borderLeftWidth: 2, padding: 20, width: 300 },
	cartHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
	cartTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	cartOrderNumber: { color: colors.muted, fontSize: 12, fontWeight: '700' },
	cartList: { maxHeight: 340, marginBottom: 12 },
	emptyOrder: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 20, textAlign: 'center' },
	cartItem: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 12 },
	cartItemTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	cartItemName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '800' },
	cartItemPrice: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	cartItemMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
	cartQuantityRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
	cartQuantityButton: { alignItems: 'center', backgroundColor: '#F1EFEA', borderRadius: 6, height: 22, justifyContent: 'center', width: 22 },
	cartQuantityButtonDisabled: { opacity: 0.4 },
	cartQuantityText: { color: colors.ink, fontSize: 13, fontWeight: '800', lineHeight: 14 },
	cartQuantity: { color: colors.ink, fontSize: 12, fontWeight: '800', minWidth: 16, textAlign: 'center' },
	totalRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
	totalLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
	total: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	orderMessage: { color: '#2E7D4F', fontSize: 12, lineHeight: 17, marginTop: 10 },
	orderMessageError: { color: '#C0503F' },
	placeOrderButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, justifyContent: 'center', marginTop: 14, minHeight: 52 },
	placeOrderButtonDisabled: { backgroundColor: '#C7C1B8' },
	placeOrderText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

	// Shared modal styles (staff actions, inventory/sales, item editor)
	sectionLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
	modalBackdrop: { backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'flex-end' },
	editorSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 24, paddingBottom: 34 },
	reportSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '86%', padding: 24, paddingBottom: 34 },
	reportList: { maxHeight: 430 },
	reportRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 15 },
	reportName: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '700' },
	reportQuantity: { color: colors.muted, fontSize: 13, fontWeight: '700', marginLeft: 10 },
	reportStatus: { color: '#3F8A5E', fontSize: 10, fontWeight: '800', marginLeft: 12 },
	lowStock: { color: '#C08A3F' },
	outStock: { color: '#C0503F' },
	inventorySummary: { backgroundColor: '#F1F4FE', borderRadius: 10, marginBottom: 8, padding: 16 },
	inventorySummaryValue: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	inventorySummaryLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 4 },
	inventoryRow: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 14 },
	inventoryTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
	inventoryNameBlock: { flex: 1 },
	inventoryMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
	inventoryBottomRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
	modifyStockButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 10, justifyContent: 'center', marginBottom: 12, minHeight: 44 },
	modifyStockButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
	salesTotal: { backgroundColor: '#F1F4FE', borderRadius: 10, marginBottom: 8, padding: 16 },
	salesTotalLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
	salesTotalValue: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 6 },
	demoReportNote: { color: colors.muted, fontSize: 12, marginTop: 20 },
	editorHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
	editorTitle: { color: colors.ink, fontSize: 24, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
	closeButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	editorLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10, marginTop: 8 },
	editorQuantityRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 18 },
	editorQuantityButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
	editorQuantityButtonDisabled: { backgroundColor: '#C7C1B8' },
	editorQuantityText: { color: '#FFFFFF', fontSize: 21, lineHeight: 23 },
	editorQuantity: { color: colors.ink, fontSize: 20, fontWeight: '800', marginHorizontal: 18 },
	noteInput: { backgroundColor: '#F7F6F4', borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 76, padding: 12, textAlignVertical: 'top' },
	editorActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
	removeButton: { alignItems: 'center', borderColor: '#C0503F', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 50 },
	removeButtonText: { color: '#C0503F', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
	optionRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
	optionButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 8 },
	optionButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
	optionText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
	optionTextActive: { color: '#FFFFFF' },
	saveButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, flex: 1.5, justifyContent: 'center', minHeight: 50 },
	saveButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});