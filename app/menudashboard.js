import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';
import { databaseEnabled, loadSalesReport } from './api';
import { getUnitPrice, getOptionType } from '../utils/pricing';
import { scaleTabletTypography } from '../utils/typography';

const navItems = [
	{ key: 'home', label: 'Home Page' },
	{ key: 'currentOrders', label: 'Current Orders' },
	{ key: 'inventory', label: 'Inventory' },
	{ key: 'modifyItems', label: 'Modify Items', adminOnly: true },
	{ key: 'salesReport', label: 'View Sales Report', adminOnly: true },
];

export default function MenuDashboard() {
	const { user, signOut, menuItems: rawMenuItems = [], inventoryItems, categories: menuCategories = [], createPendingOrder, lastCompletedOrder, completedOrders = [] } = useMenu();

	// Always derive size options from the category's current settings
	const menuItems = useMemo(
		() => rawMenuItems
			.filter((item) => item.availability !== false)
			.map((item) => ({ ...item, options: getOptionType(item.category, menuCategories) })),
		[rawMenuItems, menuCategories],
	);
	const categoryFilters = ['All items', ...menuCategories.map((category) => category.name)];
	const [activeCategory, setActiveCategory] = useState('All items');
	const [searchQuery, setSearchQuery] = useState('');
	const [cart, setCart] = useState({});
	const [sizeSelections, setSizeSelections] = useState({});
	const [selectedItemId, setSelectedItemId] = useState(null);
	const [selectedCartKey, setSelectedCartKey] = useState(null);
	const [logoutWarningVisible, setLogoutWarningVisible] = useState(false);
	const [editNote, setEditNote] = useState('');
	const [editCustomization, setEditCustomization] = useState({});
	const [staffPanel, setStaffPanel] = useState(null);
	const [orderMessage, setOrderMessage] = useState('');
	const [orderMessageType, setOrderMessageType] = useState('success');
	const [salesPeriod, setSalesPeriod] = useState('month');
	const [selectedSalesDate, setSelectedSalesDate] = useState(() => formatSalesDate(new Date()));
	const [calendarMonth, setCalendarMonth] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	});
	const [salesCalendarVisible, setSalesCalendarVisible] = useState(false);
	const [salesReport, setSalesReport] = useState(null);
	const [salesReportError, setSalesReportError] = useState('');
	const [loadingSalesReport, setLoadingSalesReport] = useState(false);
	const [salesPeriodSegmentWidth, setSalesPeriodSegmentWidth] = useState(0);
	const salesPeriodPosition = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (staffPanel !== 'sales') return undefined;

		let active = true;
		setSalesReportError('');
		setSalesReport(null);
		if (!databaseEnabled) {
			setSalesReport(buildLocalSalesReport(completedOrders, salesPeriod, selectedSalesDate));
			setLoadingSalesReport(false);
			return () => { active = false; };
		}

		setLoadingSalesReport(true);
		loadSalesReport(salesPeriod, salesPeriod === 'day' ? selectedSalesDate : undefined)
			.then((report) => { if (active) setSalesReport(report); })
			.catch((error) => { if (active) setSalesReportError(error.message || 'Could not load sales data.'); })
			.finally(() => { if (active) setLoadingSalesReport(false); });

		return () => { active = false; };
	}, [staffPanel, salesPeriod, selectedSalesDate, completedOrders]);

	function selectSalesPeriod(period, index) {
		setSalesPeriod(period);
		setSalesCalendarVisible(false);
		if (!salesPeriodSegmentWidth) return;

		Animated.timing(salesPeriodPosition, {
			toValue: index * salesPeriodSegmentWidth,
			duration: 220,
			useNativeDriver: true,
		}).start();
	}

	function openSalesCalendar() {
		const [year, month] = selectedSalesDate.split('-').map(Number);
		setCalendarMonth(new Date(year, month - 1, 1));
		setSalesCalendarVisible((visible) => !visible);
	}

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
	const outOfStockItems = sortedInventoryItems.filter((item) => Number(item.quantity) <= 0);
	const lowStockItems = sortedInventoryItems.filter((item) => (
		Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderPoint)
	));

	const orderItems = Object.entries(cart)
		.map(([cartKey, line]) => {
			const item = menuItems.find((menuItem) => menuItem.id === line.itemId);
			return item ? { ...item, ...line, cartKey } : null;
		})
		.filter(Boolean);
	const itemCount = orderItems.reduce((total, line) => total + line.quantity, 0);
	const subtotal = orderItems.reduce(
		(total, line) => total + getUnitPrice(line, line.customization) * line.quantity,
		0,
	);

	useEffect(() => {
		if (!lastCompletedOrder) return;

		setCart({});
		setSizeSelections({});
		setSelectedItemId(null);
		setSelectedCartKey(null);
		setOrderMessageType('success');
		setOrderMessage(`${lastCompletedOrder.orderNumber} paid by ${formatPaymentMethod(lastCompletedOrder.paymentMethod)}. Inventory updated.`);
	}, [lastCompletedOrder?.id]);

	function getCartKey(itemId, customization) {
		return JSON.stringify([itemId, customization.size || '', customization.milk || '', customization.ice || '']);
	}

	function getItemQuantity(itemId, sourceCart = cart) {
		return Object.values(sourceCart)
			.filter((line) => line.itemId === itemId)
			.reduce((total, line) => total + line.quantity, 0);
	}

	function getSelectedCustomization(item) {
		const customization = getDefaultCustomization(item);
		if (sizeSelections[item.id]) customization.size = sizeSelections[item.id];
		return customization;
	}

	function changeQuantity(item, change, customization = getSelectedCustomization(item), note = '') {
		setOrderMessage('');
		setCart((currentCart) => {
			const cartKey = getCartKey(item.id, customization);
			const currentLine = currentCart[cartKey];
			const nextQuantity = (currentLine?.quantity || 0) + change;
			const nextCart = { ...currentCart };

			if (nextQuantity <= 0) {
				delete nextCart[cartKey];
			} else {
				nextCart[cartKey] = {
					itemId: item.id,
					quantity: nextQuantity,
					customization,
					note: currentLine?.note || note,
				};
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

		const result = createPendingOrder({ cart });

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

	function openItemEditor(itemId, cartKey = null) {
		const item = menuItems.find((menuItem) => menuItem.id === itemId);
		const defaultCustomization = getSelectedCustomization(item);
		const key = cartKey || getCartKey(itemId, defaultCustomization);
		const line = cart[key];

		setSelectedItemId(itemId);
		setSelectedCartKey(key);
		setEditNote(line?.note || '');
		setEditCustomization(line?.customization || defaultCustomization);
	}

	function closeItemEditor() {
		setSelectedItemId(null);
		setSelectedCartKey(null);
		setEditNote('');
		setEditCustomization({});
	}

	function saveItemChanges() {
		if (!selectedItemId || !selectedItem) return;
		const targetKey = getCartKey(selectedItemId, editCustomization);
		setCart((currentCart) => {
			const nextCart = { ...currentCart };
			const sourceLine = selectedCartKey ? nextCart[selectedCartKey] : null;
			const targetLine = nextCart[targetKey];

			if (sourceLine && selectedCartKey !== targetKey) {
				delete nextCart[selectedCartKey];
			}
			if (sourceLine || targetLine) {
				nextCart[targetKey] = {
					itemId: selectedItemId,
					quantity: (sourceLine?.quantity || 0) + (selectedCartKey === targetKey ? 0 : targetLine?.quantity || 0),
					customization: editCustomization,
					note: editNote.trim(),
				};
			}
			return nextCart;
		});
		closeItemEditor();
	}

	function removeSelectedItem() {
		if (!selectedItemId || !selectedCartKey) return;

		setCart((currentCart) => {
			const nextCart = { ...currentCart };
			delete nextCart[selectedCartKey];
			return nextCart;
		});
		closeItemEditor();
	}

	const selectedItem = menuItems.find((item) => item.id === selectedItemId);

	function updateCustomization(key, value) {
		setEditCustomization((currentCustomization) => ({ ...currentCustomization, [key]: value }));
	}

	// Quick inline size selector for coffee/cold-drink items directly on the grid card,
	// without opening the full editor modal.
	function quickSetSize(item, size) {
		setSizeSelections((current) => ({ ...current, [item.id]: size }));
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.shell}>
				<View style={styles.sidebar}>
					<Image
						source={require('../assets/cafe101logo.png')}
						style={styles.logo}
						resizeMode="contain"
					/>
					<View style={styles.navList}>
						{navItems.filter((nav) => !nav.adminOnly || user?.role === 'admin').map((nav) => (
							<Pressable
								key={nav.key}
								onPress={() => {
									if (nav.key === 'inventory') setStaffPanel('inventory');
									else if (nav.key === 'currentOrders') router.push('/currentorders');
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
						onPress={() => { setCart({}); setSizeSelections({}); setOrderMessage(''); }}
						style={styles.resetButton}
					>
						<Text style={styles.resetButtonText}>Reset Order</Text>
					</Pressable>
					<Pressable onPress={() => setLogoutWarningVisible(true)} style={styles.logoutButton}>
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
						{categoryFilters.map((category) => (
							<Pressable
								key={category}
								onPress={() => setActiveCategory(category)}
								style={[styles.categoryChip, activeCategory === category && styles.categoryChipActive]}
							>
								<Text style={[styles.categoryText, activeCategory === category && styles.categoryTextActive]}>{category}</Text>
							</Pressable>
						))}
					</ScrollView>

					<Text style={styles.menuTitle}>{activeCategory === 'All items' ? '  Menu' : `${activeCategory} menu`}</Text>

					<View style={styles.menuGrid}>
						{visibleItems.map((item) => {
							const canAddItem = canMakeItem(item, getItemQuantity(item.id) + 1);
							const hasAnyStock = canMakeItem(item);
							const hasSizes = ['coffee', 'coldDrink', 'size'].includes(item.options);
							const sizeOptions = item.options === 'coldDrink' ? ['R', 'L'] : ['S', 'M', 'L'];
							const activeSize = getSelectedCustomization(item).size;

							return (
								<Pressable key={item.id} onPress={() => openItemEditor(item.id)} style={styles.menuCard}>
									{/* Left: image + quantity */}
									<View style={styles.cardLeft}>
										<View style={styles.imageBox}>
											{item.imageUri ? (
												<Image source={{ uri: item.imageUri }} style={styles.itemImage} resizeMode="contain" />
											) : (
												<View style={[styles.itemIcon, { backgroundColor: item.accent }]}>
													<Text style={styles.itemIconText}>{item.name.charAt(0)}</Text>
												</View>
											)}
										</View>
										<View style={styles.countButtonsWrap}>
										</View>
									</View>

									{/* Right: name, description, price + size, add order */}
									<View style={styles.cardRight}>
										<Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
										<Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
										{!hasAnyStock ? <Text style={styles.stockHint}>Out of stock</Text> : null}

										<View style={styles.cardRow}>
											<Text style={styles.price}>₱{getUnitPrice(item, { size: activeSize }).toFixed(2)}</Text>
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

										<Pressable
											disabled={!canAddItem}
											onPress={(event) => { event.stopPropagation(); changeQuantity(item, 1, getSelectedCustomization(item)); }}
											style={[styles.addButton, !canAddItem && styles.addButtonDisabled]}
										>
											<Text style={styles.addButtonText}>Add Order +</Text>
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
						<Text style={styles.cartTitle}>  Order</Text>
						<Text style={styles.cartOrderNumber}>{lastCompletedOrder ? lastCompletedOrder.orderNumber : 'Order #1'}</Text>
					</View>

					<ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
						{orderItems.length ? orderItems.map((line) => {
							const canAddMore = canMakeItem(line, getItemQuantity(line.id) + 1);
							const custom = line.customization;

							return (
								<Pressable key={line.cartKey} onPress={() => openItemEditor(line.id, line.cartKey)} style={styles.cartItem}>
									<View style={styles.cartItemTop}>
										<Text style={styles.cartItemName}>{line.name}</Text>
										<Text style={styles.cartItemPrice}>
											₱{(getUnitPrice(line, custom) * line.quantity).toFixed(2)}
										</Text>
									</View>
									{custom?.size ? <Text style={styles.cartItemMeta}>{custom.size}{custom.milk ? ` · ${custom.milk}` : ''}{custom.ice ? ` · ${custom.ice} ice` : ''}</Text> : null}
									{line.note ? <Text style={styles.cartItemMeta}>Note: {line.note}</Text> : null}
									<View style={styles.cartQuantityRow}>
										<Pressable onPress={() => changeQuantity(line, -1, custom)} style={styles.cartQuantityButton}><Text style={styles.cartQuantityText}>-</Text></Pressable>
										<Text style={styles.cartQuantity}>{line.quantity}</Text>
										<Pressable disabled={!canAddMore} onPress={() => changeQuantity(line, 1, custom)} style={[styles.cartQuantityButton, !canAddMore && styles.cartQuantityButtonDisabled]}><Text style={styles.cartQuantityText}>+</Text></Pressable>
									</View>
								</Pressable>
							);
						}) : <Text style={styles.emptyOrder}>Select a menu item.</Text>}
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

			<Modal
				animationType="fade"
				transparent
				visible={logoutWarningVisible}
				onRequestClose={() => setLogoutWarningVisible(false)}
			>
				<View style={styles.logoutBackdrop}>
					<View style={styles.logoutDialog}>
						<Text style={styles.logoutTitle}>Log out?</Text>
						<Text style={styles.logoutMessage}>Are you sure you want to log out? Your current order will be lost.</Text>
						<View style={styles.logoutActions}>
							<Pressable onPress={() => setLogoutWarningVisible(false)} style={styles.logoutCancelButton}>
								<Text style={styles.logoutCancelText}>CANCEL</Text>
							</Pressable>
							<Pressable
								onPress={() => {
									setLogoutWarningVisible(false);
									signOut();
									router.replace('/login');
								}}
								style={styles.logoutConfirmButton}
							>
								<Text style={styles.logoutConfirmText}>LOG OUT</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			<Modal animationType="slide" transparent visible={Boolean(staffPanel)} onRequestClose={() => setStaffPanel(null)}>
				<View style={styles.modalBackdrop}>
					<View style={styles.reportSheet}>
						<View style={styles.editorHeader}>
							<View>
								<Text style={styles.editorTitle}>{staffPanel === 'inventory' ? 'Stock overview' : 'Sales Report'}</Text>
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
								{outOfStockItems.length || lowStockItems.length ? (
									<View style={styles.inventoryWarning} accessibilityRole="alert">
										<Text style={styles.inventoryWarningTitle}>Inventory needs attention</Text>
										<Text style={styles.inventoryWarningMessage}>
											{outOfStockItems.length ? `${outOfStockItems.length} out of stock` : ''}
											{outOfStockItems.length && lowStockItems.length ? ' · ' : ''}
											{lowStockItems.length ? `${lowStockItems.length} low stock` : ''}
										</Text>
										<Text style={styles.inventoryWarningItems}>
											{[...outOfStockItems, ...lowStockItems].map((item) => item.name).join(', ')}
										</Text>
									</View>
								) : null}
								<View style={styles.inventoryActions}>
									{user?.role === 'admin' ? <Pressable
										onPress={() => { setStaffPanel(null); router.push('/modifyinventory'); }}
										style={styles.modifyStockButton}
									>
										<Text style={styles.modifyStockButtonText}>Modify Inventory Stock</Text>
									</Pressable> : null}
								</View>
								<FlatList
									columnWrapperStyle={styles.inventoryGridRow}
									data={sortedInventoryItems}
									keyExtractor={(item) => item.id}
									ListEmptyComponent={<Text style={styles.salesEmpty}>No inventory items yet.</Text>}
									numColumns={2}
									renderItem={({ item }) => {
										const status = getStockStatus(item);

										return (
											<View style={styles.inventoryRow}>
												<View style={styles.inventoryTopRow}>
													<View style={styles.inventoryNameBlock}>
														<Text style={styles.inventoryGridName}>{item.name}</Text>
													</View>
													<Text style={styles.reportQuantity}>{formatStockQuantity(item.quantity, item.unit)}</Text>
												</View>
												<View style={styles.inventoryBottomRow}>
													<Text style={[styles.reportStatus, status === 'Low stock' && styles.lowStock, status === 'Out' && styles.outStock]}>{status}</Text>
												</View>
											</View>
										);
									}}
									showsVerticalScrollIndicator={false}
									style={styles.reportList}
								/>
							</>
						) : (
							<ScrollView style={styles.salesReportScroll} contentContainerStyle={styles.salesReportContent} showsVerticalScrollIndicator={false}>
								<View style={styles.salesToolbar}>
									<View
										onLayout={(event) => {
											const segmentWidth = (event.nativeEvent.layout.width - 6) / 4;
											setSalesPeriodSegmentWidth(segmentWidth);
											const periodIndex = ['today', 'week', 'month'].indexOf(salesPeriod);
											if (periodIndex >= 0) salesPeriodPosition.setValue(periodIndex * segmentWidth);
										}}
										style={styles.salesPeriods}
									>
										<Animated.View
											pointerEvents="none"
											style={[
												styles.salesPeriodIndicator,
												{
													opacity: salesPeriod === 'day' ? 0 : 1,
													transform: [{ translateX: salesPeriodPosition }],
													width: salesPeriodSegmentWidth,
												},
											]}
										/>
										{[{ key: 'today', label: 'Today' }, { key: 'week', label: '7 days' }, { key: 'month', label: '30 days' }, { key: 'day', label: 'Date' }].map((period, index) => (
											<Pressable key={period.key} onPress={() => period.key === 'day' ? openSalesCalendar() : selectSalesPeriod(period.key, index)} style={styles.salesPeriod}>
												<Text style={[styles.salesPeriodText, salesPeriod === period.key && styles.salesPeriodTextActive]}>{period.label}</Text>
											</Pressable>
										))}
									</View>
								</View>
								{salesPeriod === 'day' ? (
									<Pressable onPress={() => setSalesCalendarVisible((visible) => !visible)} style={styles.selectedSalesDate}>
										<Text style={styles.salesPeriodCaption}>Showing sales for {formatSalesDateLabel(selectedSalesDate)}</Text>
										<Text style={styles.changeSalesDateText}>CHANGE DATE</Text>
									</Pressable>
								) : null}
								{salesCalendarVisible ? (
									<View style={styles.salesCalendar}>
										<View style={styles.salesCalendarHeader}>
											<Pressable
												accessibilityLabel="Previous month"
												onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
												style={styles.calendarMonthButton}
											>
												<Text style={styles.calendarMonthButtonText}>{'<'}</Text>
											</Pressable>
											<Text style={styles.calendarMonthTitle}>
												{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
											</Text>
											<Pressable
												accessibilityLabel="Next month"
												onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
												style={styles.calendarMonthButton}
											>
												<Text style={styles.calendarMonthButtonText}>{'>'}</Text>
											</Pressable>
										</View>
										<View style={styles.calendarGrid}>
											{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
												<Text key={`${day}-${index}`} style={styles.calendarWeekday}>{day}</Text>
											))}
											{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }, (_, index) => (
												<View key={`empty-${index}`} style={styles.calendarDay} />
											))}
											{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => {
												const day = index + 1;
												const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
												const dateValue = formatSalesDate(date);
												const isSelected = selectedSalesDate === dateValue;

												return (
													<Pressable
														key={dateValue}
														onPress={() => {
															setSelectedSalesDate(dateValue);
															setSalesPeriod('day');
															setSalesCalendarVisible(false);
														}}
														style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
													>
														<Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>{day}</Text>
													</Pressable>
												);
											})}
										</View>
									</View>
								) : null}
								<View style={styles.salesPeriodStatus}>
									{loadingSalesReport && salesReport ? <ActivityIndicator color={colors.accent} size="small" /> : null}
								</View>
								{salesReportError ? <Text style={styles.salesError}>{salesReportError}</Text> : null}
								{loadingSalesReport && !salesReport ? (
									<Text style={styles.salesEmpty}>
										{salesPeriod === 'day'
											? `Loading sales for ${formatSalesDateLabel(selectedSalesDate)}...`
											: 'Loading sales data...'}
									</Text>
								) : null}
								{salesReport ? (
									<>
										<View style={styles.salesMetricGrid}>
											<View style={styles.salesMetric}><Text style={styles.salesMetricLabel}>Total Revenue</Text><Text style={styles.salesMetricValue}>₱{Number(salesReport.totalRevenue).toFixed(2)}</Text></View>
											<View style={styles.salesMetric}><Text style={styles.salesMetricLabel}>Paid Orders</Text><Text style={styles.salesMetricValue}>{salesReport.orderCount}</Text></View>
											<View style={styles.salesMetric}><Text style={styles.salesMetricLabel}>Average Order Value</Text><Text style={styles.salesMetricValue}>₱{Number(salesReport.averageOrderValue).toFixed(2)}</Text></View>
											<View style={styles.salesMetric}><Text style={styles.salesMetricLabel}>Units Sold</Text><Text style={styles.salesMetricValue}>{salesReport.unitsSold}</Text></View>
										</View>
										<View style={styles.salesSection}>
											<Text style={styles.salesSectionTitle}>Sales by category</Text>
											{salesReport.categorySales.length ? (
												<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChart}>
													{salesReport.categorySales.map((category) => {
														const maximum = salesReport.categorySales[0].revenue;
														const barHeight = maximum ? Math.max(4, (category.revenue / maximum) * 150) : 4;

														return (
															<View key={category.name} style={styles.categoryColumn}>
																<View style={styles.categoryBarArea}>
																	<Text style={styles.categorySalesValue}>₱{Number(category.revenue).toFixed(2)}</Text>
																	<View style={[styles.categoryBar, { height: barHeight }]} />
																</View>
																<Text style={styles.categorySalesName} numberOfLines={2}>{category.name}</Text>
															</View>
														);
													})}
												</ScrollView>
											) : <Text style={styles.salesEmpty}>No paid orders in this period.</Text>}
										</View>
										<View style={styles.salesSection}>
											<Text style={styles.salesSectionTitle}>Top-selling items</Text>
											{salesReport.topItems.length ? salesReport.topItems.map((item, index) => (
												<View key={item.name} style={styles.topItemRow}>
													<Text style={styles.topItemRank}>{String(index + 1).padStart(2,)}</Text>
													<Text style={styles.topItemName}>{item.name}</Text>
													<Text style={styles.topItemUnits}>{Number(item.quantity)} sold</Text>
													<Text style={styles.topItemRevenue}>₱{Number(item.revenue).toFixed(2)}</Text>
												</View>
											)) : <Text style={styles.salesEmpty}>Top sellers will appear after an order is paid.</Text>}
										</View>
									</>
								) : null}
							</ScrollView>
						)}
					</View>
				</View>
			</Modal>

			<Modal animationType="slide" transparent visible={Boolean(selectedItem)} onRequestClose={closeItemEditor}>
				<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
					<View style={styles.editorSheet}>
						<View style={styles.editorHeader}>
							<View>
								<Text style={styles.editorTitle}>{selectedItem?.name}</Text>
							</View>
							<Pressable accessibilityLabel="Close item editor" onPress={closeItemEditor} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>X</Text>
							</Pressable>
						</View>
						{selectedItem?.options === 'size' ? (
							<>
								<Text style={styles.editorLabel}>SIZE</Text>
								<View style={styles.optionRow}>
									{['Small', 'Medium', 'Large'].map((size) => (
										<Pressable key={size} onPress={() => updateCustomization('size', size)} style={[styles.optionButton, editCustomization.size === size && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.size === size && styles.optionTextActive]}>{size} · ₱{getUnitPrice(selectedItem, { size }).toFixed(2)}</Text>
										</Pressable>
									))}
								</View>
							</>
						) : null}

						{selectedItem?.options === 'coffee' ? (
							<>
								<Text style={styles.editorLabel}>SIZE</Text>
								<View style={styles.optionRow}>
									{['Small', 'Medium', 'Large'].map((size) => (
										<Pressable key={size} onPress={() => updateCustomization('size', size)} style={[styles.optionButton, editCustomization.size === size && styles.optionButtonActive]}>
											<Text style={[styles.optionText, editCustomization.size === size && styles.optionTextActive]}>{size} · ₱{getUnitPrice(selectedItem, { size }).toFixed(2)}</Text>
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
											<Text style={[styles.optionText, editCustomization.size === size && styles.optionTextActive]}>{size} · ₱{getUnitPrice(selectedItem, { size }).toFixed(2)}</Text>
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
				</KeyboardAvoidingView>
			</Modal>
		</SafeAreaView>
	);
}

const colors = {
	background: '#FFFFFF',
	ink: '#25170E',
	muted: '#9B958D',
	accent: '#dad4d4',
	border: '#EDEAE5',
	panel: '#FFFFFF',
	sidebar: '#FFFFFF',
	chipBorder: '#E4E0DA',
	cartBg: '#FAFAF8',
	cardBg: '#FDFCFB',
};

// Default size is the BASE size (smallest), which carries the base price
function getDefaultCustomization(item) {
	if (item?.options === 'coffee') return { size: 'Small', milk: 'Regular' };
	if (item?.options === 'coldDrink') return { size: 'Regular', ice: 'Regular' };
	if (item?.options === 'size') return { size: 'Small' };
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

function formatSalesDate(date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
}

function formatSalesDateLabel(dateValue) {
const [year, month, day] = dateValue.split('-').map(Number);
return new Date(year, month - 1, day).toLocaleDateString(undefined, {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
});
}

function buildLocalSalesReport(orders, period, selectedDate) {
const start = new Date();
start.setHours(0, 0, 0, 0);
if (period === 'week') start.setDate(start.getDate() - 6);
if (period === 'month') start.setDate(start.getDate() - 29);
const filteredOrders = orders.filter((order) => {
	const orderDate = new Date(order.paidAt || order.createdAt);
	if (period === 'day') return formatSalesDate(orderDate) === selectedDate;
	return orderDate >= start;
});
	const items = new Map();
	const categories = new Map();
	let unitsSold = 0;

	for (const order of filteredOrders) {
		for (const soldItem of order.items) {
			const quantity = Number(soldItem.quantity) || 0;
			const revenue = Number(soldItem.lineTotal) || 0;
			unitsSold += quantity;
			const item = items.get(soldItem.name) || { name: soldItem.name, quantity: 0, revenue: 0 };
			item.quantity += quantity;
			item.revenue += revenue;
			items.set(soldItem.name, item);
			const categoryName = soldItem.category || 'Uncategorized';
			const category = categories.get(categoryName) || { name: categoryName, revenue: 0 };
			category.revenue += revenue;
			categories.set(categoryName, category);
		}
	}

	const totalRevenue = filteredOrders.reduce((total, order) => total + (Number(order.subtotal) || 0), 0);
	return {
		period,
		totalRevenue,
		orderCount: filteredOrders.length,
		averageOrderValue: filteredOrders.length ? totalRevenue / filteredOrders.length : 0,
		unitsSold,
		categorySales: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
		topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
	};
}

const styles = StyleSheet.create(scaleTabletTypography({
	safeArea: { backgroundColor: colors.background, flex: 1 },
	shell: { flex: 1, flexDirection: 'row' },

	// Sidebar
	sidebar: { backgroundColor: colors.sidebar, borderRightColor: colors.border, borderRightWidth: 1, paddingHorizontal: 18, paddingTop: 26, width: 176 },
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
	logoutBackdrop: { alignItems: 'center', backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'center', padding: 24 },
	logoutDialog: { backgroundColor: colors.panel, borderRadius: 14, maxWidth: 420, padding: 24, width: '100%' },
	logoutTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
	logoutMessage: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 10 },
	logoutActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
	logoutCancelButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
	logoutCancelText: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
	logoutConfirmButton: { alignItems: 'center', backgroundColor: '#C0503F', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 44 },
	logoutConfirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
	logo: { height: 140, width: 140, marginTop: -20 },

	// Main panel
	mainPanel: { flex: 1 },
	mainContent: { padding: 24, paddingBottom: 40 },
	searchInput: { backgroundColor: '#F7F6F4', borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 14, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 12 },
	categoryScroll: { marginBottom: 18 },
	categoryChip: { alignItems: 'center', borderColor: colors.chipBorder, borderRadius: 20, borderWidth: 1, justifyContent: 'center', marginRight: 8, paddingHorizontal: 18, paddingVertical: 10 },
	categoryChipActive: { backgroundColor: '#25170E', borderColor: colors.ink },
	categoryText: { color: '#6F6A63', fontSize: 12, fontWeight: '700' },
	categoryTextActive: { color: '#FFFFFF' },
	menuTitle: { color: '#25170E', fontSize: 24, fontWeight: '800', marginBottom: 16 },
	menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },

	// Menu card: image + quantity on the left, details on the right
	menuCard: { backgroundColor: colors.cardBg, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14, width: '47%' },
	cardLeft: { alignItems: 'center', gap: 10, width: 96 },
	imageBox: { backgroundColor: '#F7F6F4', borderRadius: 12, height: 96, overflow: 'hidden', width: 96 },
	cardRight: { flex: 1, minWidth: 0 },
	itemImage: { height: '100%', width: '100%' },
	itemIcon: { alignItems: 'center', borderRadius: 12, height: '100%', justifyContent: 'center', width: '100%' },
	itemIconText: { fontSize: 30, fontWeight: '800' },
	itemName: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
	itemDescription: { color: colors.muted, fontSize: 11, lineHeight: 15, marginBottom: 8 },
	stockHint: { color: '#C0503F', fontSize: 10, fontWeight: '700', marginBottom: 6 },
	cardRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginBottom: 10 },
	price: { color: colors.ink, fontSize: 14, fontWeight: '800' },
	sizeRow: { flexDirection: 'row', gap: 4 },
	sizeButton: { alignItems: 'center', backgroundColor: '#F1EFEA', borderRadius: 6, height: 22, justifyContent: 'center', width: 22 },
	sizeButtonActive: { backgroundColor: colors.ink },
	sizeText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
	sizeTextActive: { color: '#FFFFFF' },
	countButtonsWrap: { alignItems: 'center', flexDirection: 'row', gap: 6 },
	addButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, justifyContent: 'center', marginTop: 'auto', minHeight: 34 },
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
	// Shared modal styles (staff actions, inventory/sales, item editor)
	modalBackdrop: { backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'flex-end' },
	editorSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 24, paddingBottom: 34 },
	reportSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '86%', padding: 24, paddingBottom: 34 },
	reportList: { maxHeight: 430 },
	inventoryGridRow: { gap: 12 },
	salesReportScroll: { flexShrink: 1 },
	salesReportContent: { paddingBottom: 4 },
	reportQuantity: { color: colors.muted, fontSize: 15, fontWeight: '700', marginLeft: 10 },
	reportStatus: { color: '#3F8A5E', fontSize: 15, fontWeight: '800', marginLeft: 12 },
	lowStock: { color: '#C08A3F' },
	outStock: { color: '#C0503F' },
	inventorySummary: { backgroundColor: '#b0b18b', borderRadius: 10, marginBottom: 8, padding: 16 },
	inventorySummaryValue: { color: colors.ink, fontSize: 30, fontWeight: '800' },
	inventorySummaryLabel: { color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 4 },
	inventoryWarning: { backgroundColor: '#F8E8E4', borderColor: '#E8BEB5', borderRadius: 9, borderWidth: 1, marginBottom: 12, padding: 14 },
	inventoryWarningTitle: { color: '#A33F32', fontSize: 14, fontWeight: '800' },
	inventoryWarningMessage: { color: '#A33F32', fontSize: 12, fontWeight: '700', marginTop: 4 },
	inventoryWarningItems: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 4 },
	inventoryRow: { backgroundColor: '#FAFAF8', borderBottomColor: colors.border, borderBottomWidth: 1, flex: 1, marginBottom: 8, minWidth: 0, padding: 12 },
	inventoryGridName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
	inventoryTopRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
	inventoryNameBlock: { flex: 1 },
	inventoryBottomRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
	inventoryActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
	modifyStockButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
	modifyStockButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
	salesToolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
	salesPeriods: { backgroundColor: '#F2F1EE', borderRadius: 7, flexDirection: 'row', overflow: 'hidden', padding: 3, position: 'relative' },
	salesPeriodIndicator: { backgroundColor: '#FFFFFF', borderRadius: 5, bottom: 3, left: 3, position: 'absolute', top: 3 },
	salesPeriod: { alignItems: 'center', borderRadius: 5, flex: 1, justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 7, zIndex: 1 },
	salesPeriodText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
	salesPeriodTextActive: { color: colors.ink },
	selectedSalesDate: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
	changeSalesDateText: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
	salesCalendar: { backgroundColor: '#FAFAF8', borderColor: colors.border, borderRadius: 9, borderWidth: 1, marginBottom: 8, marginTop: 4, padding: 10 },
	salesCalendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
	calendarMonthButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 36 },
	calendarMonthButtonText: { color: colors.ink, fontSize: 17, fontWeight: '700' },
	calendarMonthTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
	calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
	calendarWeekday: { color: colors.muted, fontSize: 10, fontWeight: '800', paddingVertical: 7, textAlign: 'center', width: '14.2857%' },
	calendarDay: { alignItems: 'center', height: 36, justifyContent: 'center', width: '14.2857%' },
	calendarDaySelected: { backgroundColor: colors.accent, borderRadius: 18 },
	calendarDayText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
	calendarDayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
	salesPeriodStatus: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	salesPeriodCaption: { color: colors.ink, fontSize: 11, marginBottom: 12 },
	salesError: { color: '#C0503F', fontSize: 12, paddingVertical: 12 },
	salesEmpty: { color: colors.muted, fontSize: 12, paddingVertical: 14 },
	salesMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
	salesMetric: { backgroundColor: '#d7ddd0', borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexBasis: '48%', flexGrow: 1, flexShrink: 1, minWidth: 0, padding: 12 }, salesMetricLabel: { color: colors.ink, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, },
	salesMetricValue: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 5 },
	salesSection: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 10, paddingTop: 14 },
	salesSectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 8 },

	categoryChart: { alignItems: 'flex-start', gap: 16, paddingBottom: 4, paddingTop: 8 },
	categoryColumn: { alignItems: 'center', width: 72 },
	categoryBarArea: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, height: 180, justifyContent: 'flex-end', width: '100%' },
	categoryBar: { backgroundColor: '#826949', borderRadius: 4, width: 36 },
	categorySalesValue: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 6 },
	categorySalesName: { color: '#555B58', fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },

	topItemRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 8, paddingVertical: 11 },
	topItemRank: { color: '#0a0a0a', fontSize: 10, fontWeight: '800', width: 22 },
	topItemName: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '700' },
	topItemUnits: { color: colors.muted, fontSize: 10, width: 52 },
	topItemRevenue: { color: colors.ink, fontSize: 11, fontWeight: '800' },
	editorHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
	editorTitle: { color: colors.ink, fontSize: 24, fontWeight: '800' },
	closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
	closeButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
	editorLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10, marginTop: 8 },
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
}));