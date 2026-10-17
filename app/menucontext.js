import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authenticateUser,

	createCategoryApi,
	databaseEnabled,
	loadCafeState,
	loadCategories,
	loadSpillageInventory,

	removeCategoryApi,
	removeInventoryItem,
	removeMenuItem,
	saveInventoryItem,
	saveMenuItem,
	saveOrder,
	saveSpillageLog,
	setAuthToken,

	updateCategoryApi,
} from './api';
import { getUnitPrice } from '../utils/pricing';

const initialMenuItems = [
	{
		id: 'americano',
		name: 'Cafe Americano',
		category: 'Coffee Series',
		description: 'Bold espresso, hot water',
		price: 3.5,
		accent: '#B75E43',
		options: 'coffee',
		ingredients: [
			{ name: 'Espresso', amount: 18, unit: 'g' },
			{ name: 'Hot water', amount: 180, unit: 'ml' },
		],
		measurementAmount: 18,
		measurementUnit: 'g',
	},
	{
		id: 'latte',
		name: 'Spanish Latte',
		category: 'Coffee Series',
		description: 'Espresso, steamed milk',
		price: 4.5,
		accent: '#C8945E',
		options: 'coffee',
		ingredients: [
			{ name: 'Espresso', amount: 18, unit: 'g' },
			{ name: 'Steamed milk', amount: 200, unit: 'ml' },
		],
		measurementAmount: 250,
		measurementUnit: 'ml',
	},
	{
		id: 'blueberry',
		name: 'Blueberry Milky',
		category: 'Milky Series',
		description: 'blueberry milk',
		price: 5,
		accent: '#7C5744',
		options: 'coffee',
		ingredients: [
			{ name: 'Blueberry syrup', amount: 30, unit: 'ml' },
			{ name: 'Milk', amount: 220, unit: 'ml' },
		],
		measurementAmount: 300,
		measurementUnit: 'ml',
	},
	{
		id: 'fries',
		name: 'French Fries',
		category: 'Snacks',
		description: 'Crispy golden fries',
		price: 3.25,
		accent: '#D29A4A',
		options: 'none',
		ingredients: [
			{ name: 'Fries', amount: 60, unit: 'g' },
		],
		measurementAmount: 1,
		measurementUnit: 'piece',
	},
	{
		id: 'chickenmeal',
		name: 'Chicken Meal',
		category: 'Meals',
		description: 'Chicken rice',
		price: 7.5,
		accent: '#76835A',
		options: 'none',
		ingredients: [
			{ name: 'Chicken', amount: 100, unit: 'g' },
			{ name: 'Rice', amount: 200, unit: 'g' },
			{ name: 'Salt', amount: 10, unit: 'mg' },
			{ name: 'Pepper', amount: 10, unit: 'mg' },
			{ name: 'Flour', amount: 50, unit: 'g' },
			{ name: 'Butter', amount: 10, unit: 'g' },
			{ name: 'Egg', amount: 1, unit: 'piece' },
		],
		measurementAmount: 1,
		measurementUnit: 'serving',
	},
	{
		id: 'strawberry-soda',
		name: 'Strawberry Soda',
		category: 'Non-Coffee Series',
		description: 'Fresh strawberry, mint, ice',
		price: 3.75,
		accent: '#D5B744',
		options: 'coldDrink',
		ingredients: [
			{ name: 'Strawberry syrup', amount: 40, unit: 'ml' },
			{ name: 'Soda', amount: 30, unit: 'g' },
			{ name: 'Water', amount: 280, unit: 'ml' },
		],
		measurementAmount: 350,
		measurementUnit: 'ml',
	},
];

const initialInventoryItems = [
	createInventoryItem('Espresso', 6000, 'g', 1000, 1000),
	createInventoryItem('Hot water', 50000, 'ml', 5000, 10000),
	createInventoryItem('Steamed milk', 20000, 'ml', 4000, 5000),
	createInventoryItem('Chocolate sauce', 4000, 'ml', 700, 1000),
	createInventoryItem('Milk', 18000, 'ml', 3500, 5000),
	createInventoryItem('Flour', 10000, 'g', 2000, 2500),
	createInventoryItem('Butter', 5000, 'g', 1000, 1000),
	createInventoryItem('Egg', 36, 'piece', 8, 12),
	createInventoryItem('Strawberry syrup', 5000, 'ml', 800, 1000),
	createInventoryItem('Soda', 3000, 'g', 500, 1000),
	createInventoryItem('Water', 60000, 'ml', 5000, 10000),
	createInventoryItem('Blueberry syrup', 5000, 'ml', 800, 1000),
	createInventoryItem('Fries', 2000, 'g', 500, 1000),
	createInventoryItem('Chicken', 5000, 'g', 1000, 2000),
	createInventoryItem('Rice', 10000, 'g', 2000, 3000),
	createInventoryItem('Salt', 1000, 'mg', 200, 500),
	createInventoryItem('Pepper', 1000, 'mg', 200, 500),
];

// Ids are URL-safe slugs (no spaces/capitals) so DELETE/PUT /api/categories/:id always works.
// The four drink series offer sizes by default.
const sizedCategoryNames = ['Coffee Series', 'Matcha Series', 'Milky Series', 'Non-Coffee Series'];
const initialCategories = ['Coffee Series', 'Matcha Series', 'Milky Series', 'Non-Coffee Series', 'Snacks', 'Meals'].map((name) => ({
	id: `category-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
	name,
	description: '',
	supportsSize: sizedCategoryNames.includes(name),
}));

const MenuContext = createContext(null);

export function MenuProvider({ children }) {
	const [menuItems, setMenuItems] = useState(initialMenuItems);
	const [inventoryItems, setInventoryItems] = useState(initialInventoryItems);
	const [categories, setCategories] = useState(initialCategories);
	const [user, setUser] = useState(null);

	const [pendingOrder, setPendingOrder] = useState(null);
	const [lastCompletedOrder, setLastCompletedOrder] = useState(null);
	const [completedOrders, setCompletedOrders] = useState([]);
	const [completedKitchenOrderIds, setCompletedKitchenOrderIds] = useState([]);
	const [orderSequence, setOrderSequence] = useState(1);

	useEffect(() => {
		if (!databaseEnabled || !user) return;


		loadCafeState()
			.then((state) => {
				if (!state) return;
				setMenuItems(state.menuItems.map(normalizeId));
				setInventoryItems(state.inventoryItems);
				if (isCategoryList(state.categories)) {
					setCategories((current) => mergeCategories(state.categories.map(normalizeId), current));
				}
			})
			.catch((error) => console.error('Could not load cafe data:', error));

		// Categories may also come from their own endpoint; keep the built-in list if it returns nothing usable.
		loadCategories()
			.then((list) => {
				if (isCategoryList(list)) setCategories((current) => mergeCategories(list.map(normalizeId), current));
			})
			.catch((error) => console.error('Could not load categories:', error));
	}, [user]);

	async function signIn(username, password) {
		const result = await authenticateUser(username, password);
		setAuthToken(result.token || null);
		setUser(result.user);
		return result.user;
	}

	function signOut() {
		setAuthToken(null);
		setUser(null);
		setPendingOrder(null);
	}


	// ---- Menu items ----
	// Server first. The server may assign its own id, so we keep the id it returns;
	// otherwise later deletes/updates would target an id the server has never seen.
	async function createMenuItem(item) {
		let saved = item;
		if (databaseEnabled) {
			const response = await saveMenuItem(item, true);
			saved = withServerId(item, response);
		}
		setMenuItems((currentItems) => [...currentItems, saved]);
		setInventoryItems((currentItems) => {
			const nextItems = addMissingInventoryItems(currentItems, saved.ingredients);
			if (databaseEnabled) nextItems.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id)).forEach((nextItem) => saveInventoryItem(nextItem).catch(console.error));
			return nextItems;
		});
	}

	async function updateMenuItem(itemId, updates) {
		let nextId = itemId;
		if (databaseEnabled) {
			try {
				await saveMenuItem({ id: itemId, ...updates });
			} catch (error) {
				// Only starter items can be missing on the server: create them there instead
				if (!(isNotFound(error) && starterMenuIds.has(itemId))) throw error;
				const existing = menuItems.find((item) => item.id === itemId);
				const response = await saveMenuItem({ ...existing, ...updates, id: itemId }, true);
				nextId = withServerId({ id: itemId }, response).id;
			}
		}
		setMenuItems((currentItems) => currentItems.map((item) => (
			item.id === itemId ? { ...item, ...updates, id: nextId } : item
		)));
		setInventoryItems((currentItems) => {
			const nextItems = addMissingInventoryItems(currentItems, updates.ingredients);
			if (databaseEnabled) nextItems.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id)).forEach((nextItem) => saveInventoryItem(nextItem).catch(console.error));
			return nextItems;
		});
	}

	// Server first: the item is only removed locally once the server confirms.
	// A 404 means the server never had it (e.g. a starter item), so it counts as deleted.
	async function deleteMenuItem(itemId) {
		if (databaseEnabled) {
			try {
				await removeMenuItem(itemId);
			} catch (error) {
				if (!(isNotFound(error) && starterMenuIds.has(itemId))) throw error;
			}
		}
		setMenuItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
	}

	// ---- Categories ----
	// Category changes are server first: local state only changes once the server accepts it,
	// and errors are thrown so the screen can tell the user nothing was saved.
	async function addCategory({ name, description = '', supportsSize = false }) {
		const category = {
			id: `category-${Date.now()}`,
			name,
			description,
			supportsSize: Boolean(supportsSize),
		};
		let saved = category;
		if (databaseEnabled) {
			const response = await createCategoryApi(category);
			saved = withServerId(category, response);
		}
		setCategories((currentCategories) => [...currentCategories, saved]);
	}

	async function updateCategory(categoryId, patch) {
		const existing = categories.find((category) => category.id === categoryId);
		if (!existing) return;

		if (databaseEnabled) {
			try {
				await updateCategoryApi(categoryId, patch);
			} catch (error) {
				if (!(isNotFound(error) && starterCategoryIds.has(categoryId))) throw error;
				// Server doesn't know this starter category yet: create it instead
				await createCategoryApi({ ...existing, ...patch });
			}
		}

		setCategories((currentCategories) => currentCategories.map((category) => (
			category.id === categoryId ? { ...category, ...patch } : category
		)));

		// Keep menu items pointing at the renamed category
		if (patch.name && patch.name !== existing.name) {
			setMenuItems((currentItems) => currentItems.map((item) => (
				item.category === existing.name ? { ...item, category: patch.name } : item
			)));
		}
	}

	async function deleteCategory(categoryId) {
		const existing = categories.find((category) => category.id === categoryId);
		if (!existing) return { deleted: false, message: 'Category not found.' };

		const inUse = menuItems.filter((item) => item.category === existing.name);
		if (inUse.length) {
			return {
				deleted: false,
				message: `"${existing.name}" still has ${inUse.length} menu item(s). Move or delete them first.`,
			};
		}

		if (databaseEnabled) {
			try {
				await removeCategoryApi(categoryId);
			} catch (error) {
				if (error?.status === 409) {
					return { deleted: false, message: 'The server says this category is still in use.' };
				}
				if (!(isNotFound(error) && starterCategoryIds.has(categoryId))) throw error;
			}
		}
		setCategories((current) => current.filter((category) => category.id !== categoryId));
		return { deleted: true };
	}

	// ---- Inventory ----
	function addInventoryItem({ name, unit, quantity, reorderPoint, restockAmount }) {
		const item = createInventoryItem(String(name).trim(), quantity, String(unit).trim(), reorderPoint, restockAmount);

		if (inventoryItems.some((existing) => existing.id === item.id)) {
			return { added: false, message: 'An item with this name and unit already exists.' };
		}

		setInventoryItems((currentItems) => [...currentItems, item]);
		if (databaseEnabled) saveInventoryItem(item).catch(console.error);
		return { added: true };
	}

	function updateInventoryItem(itemId, patch) {
		const existing = inventoryItems.find((item) => item.id === itemId);
		if (!existing) return;

		const nextItem = { ...existing, ...patch };
		setInventoryItems((currentItems) => currentItems.map((item) => (item.id === itemId ? nextItem : item)));
		if (databaseEnabled) saveInventoryItem(nextItem).catch(console.error);
	}

	function deleteInventoryItem(itemId) {
		setInventoryItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
		if (databaseEnabled) removeInventoryItem(itemId).catch(console.error);
	}

	function updateInventoryStock(itemId, change) {
		const stockChange = Number.parseFloat(change);
		if (!Number.isFinite(stockChange) || stockChange === 0) return;

		setInventoryItems((currentItems) => {
			const nextItems = currentItems.map((item) => (
				item.id === itemId
					? { ...item, quantity: roundStock(Math.max(0, item.quantity + stockChange)) }
					: item
			));
			const changedItem = nextItems.find((item) => item.id === itemId);
			if (databaseEnabled && changedItem) saveInventoryItem(changedItem).catch(console.error);
			return nextItems;
		});
	}

	async function logSpillage({ inventoryId, quantityWasted, reason = '' }) {
		const amount = Number.parseFloat(quantityWasted);
		const item = inventoryItems.find((inventoryItem) => inventoryItem.id === inventoryId);
		if (!item || !Number.isFinite(amount) || amount <= 0) {
			return { logged: false, message: 'Choose an item and enter a quantity greater than 0.' };
		}
		if (amount > item.quantity) {
			return { logged: false, message: `Only ${item.quantity} ${item.unit} is currently in stock.` };
		}

		if (databaseEnabled) {
			await saveSpillageLog({ inventoryId, quantityWasted: amount, reason: reason.trim() });
		}

		setInventoryItems((currentItems) => currentItems.map((inventoryItem) => (
			inventoryItem.id === inventoryId
				? { ...inventoryItem, quantity: roundStock(Math.max(0, inventoryItem.quantity - amount)) }
				: inventoryItem
		)));
		return { logged: true };
	}

	const refreshSpillageInventory = useCallback(async () => {
		if (!databaseEnabled) return;
		const items = await loadSpillageInventory();
		if (!Array.isArray(items)) throw new Error('Could not load inventory for spillage logging.');
		setInventoryItems(items);
	}, []);


	// ---- Orders ----
	function completeOrder(cart) {
		const requirements = buildOrderRequirements(menuItems, cart);
		const missing = findMissingIngredients(inventoryItems, requirements);

		if (missing.length) {
			return { completed: false, missing, requirements };
		}

		const requirementsById = requirements.reduce((lookup, requirement) => ({
			...lookup,
			[requirement.id]: requirement,
		}), {});

		setInventoryItems((currentItems) => currentItems.map((item) => {
			const requirement = requirementsById[item.id];
			if (!requirement) return item;

			return {
				...item,
				quantity: roundStock(Math.max(0, item.quantity - requirement.amount)),
			};
		}));

		return { completed: true, requirements };
	}

	function createPendingOrder({ cart }) {
		const order = buildPendingOrder(menuItems, cart, orderSequence);
		if (!order.items.length) return { created: false, message: 'Add an item before reviewing the order.' };

		const requirements = buildOrderRequirements(menuItems, cart);
		const missing = findMissingIngredients(inventoryItems, requirements);

		if (missing.length) {
			return { created: false, missing, requirements };
		}

		setPendingOrder(order);
		return { created: true, order, requirements };
	}

	function clearPendingOrder() {
		setPendingOrder(null);
	}

	function completeKitchenOrder(orderId) {
		setCompletedKitchenOrderIds((currentIds) => (
			currentIds.includes(orderId) ? currentIds : [...currentIds, orderId]
		));
	}

	// `extra` carries payment details from the payment screen (transactionId, amountTendered, change)
	async function completePendingOrder(paymentMethod, extra = {}) {

		if (!pendingOrder) return { completed: false, message: 'No order is ready for payment.' };

		const result = completeOrder(pendingOrder.cart);
		if (!result.completed) return result;

		const completedOrder = {
			...pendingOrder,
			...extra,
			paymentMethod,
			paidAt: new Date().toISOString(),
			ingredientsDeducted: result.requirements,
		};
		let syncWarning = '';
		if (databaseEnabled) {
			try {
				await saveOrder(completedOrder, result.requirements);
			} catch (error) {
				syncWarning = `The payment was completed, but the order could not be shared with the kitchen: ${error.message || 'server unavailable'}`;
				console.error('Could not sync paid order with kitchen:', error);
			}
		}

		setLastCompletedOrder(completedOrder);
		setCompletedOrders((currentOrders) => [...currentOrders, completedOrder]);
		setPendingOrder(null);
		setOrderSequence((currentSequence) => currentSequence + 1);

		return { ...result, order: completedOrder, syncWarning };
	}

	return (
		<MenuContext.Provider value={{
			user,
			signIn,
			signOut,
			menuItems,
			inventoryItems,
			categories,
			pendingOrder,
			lastCompletedOrder,
			completedOrders,
			completedKitchenOrderIds,
			createMenuItem,
			updateMenuItem,
			deleteMenuItem,
			addCategory,
			createCategory: addCategory,
			updateCategory,
			deleteCategory,
			addInventoryItem,
			updateInventoryItem,
			deleteInventoryItem,
			updateInventoryStock,
			refreshSpillageInventory,

			logSpillage,
			completeOrder,
			createPendingOrder,
			clearPendingOrder,
			completeKitchenOrder,
			completePendingOrder,
		}}>
			{children}
		</MenuContext.Provider>
	);
}

export function useMenu() {
	const context = useContext(MenuContext);
	if (!context) throw new Error('useMenu must be used inside MenuProvider');
	return context;
}

function isNotFound(error) {
	return error?.status === 404;
}

// Ids of the built-in demo data. Only these may legitimately be missing on the server.
const starterMenuIds = new Set(initialMenuItems.map((item) => item.id));
const starterCategoryIds = new Set(initialCategories.map((category) => category.id));

// Use the id the server gave the saved record (id or Mongo-style _id), if any
function withServerId(local, response) {
	const serverId = response?.id ?? response?._id;
	return serverId !== undefined && serverId !== null ? { ...local, id: String(serverId) } : local;
}

function normalizeId(record) {
	if (!record || record.id !== undefined || record._id === undefined) return record;
	return { ...record, id: String(record._id) };
}

function isCategoryList(value) {
	return Array.isArray(value)
		&& value.length > 0
		&& value.every((category) => category && typeof category === 'object' && category.name);
}

// Server categories win, but if the server doesn't store supportsSize
// we keep the value we already have locally instead of resetting it to false.
function mergeCategories(incoming, current) {
	return incoming.map((category) => {
		const local = current.find((c) => c.id === category.id || c.name === category.name);
		return {
			...category,
			supportsSize: category.supportsSize ?? local?.supportsSize ?? false,
		};
	});
}

function createInventoryItem(name, quantity, unit, reorderPoint, restockAmount) {
	return {
		id: getInventoryKey(name, unit),
		name,
		quantity,
		unit,
		reorderPoint,
		restockAmount,
	};
}

function addMissingInventoryItems(currentItems, ingredients) {
	const existingIds = new Set(currentItems.map((item) => item.id));
	const newItems = getValidIngredients(ingredients)
		.filter((ingredient) => !existingIds.has(getInventoryKey(ingredient.name, ingredient.unit)))
		.map((ingredient) => createInventoryItem(
			ingredient.name,
			0,
			ingredient.unit,
			getDefaultReorderPoint(ingredient.amount),
			getDefaultRestockAmount(ingredient.amount),
		));

	return newItems.length ? [...currentItems, ...newItems] : currentItems;
}

function buildPendingOrder(menuItems, cart, orderSequence) {
	const items = Object.values(cart)
		.map((line) => {
			const item = menuItems.find((menuItem) => menuItem.id === line.itemId);
			if (!item) return null;
			const quantity = Number.parseFloat(line.quantity || 0);
			const customization = line.customization || {};

			// Price follows the chosen size (missing size = base price)
			const unitPrice = getUnitPrice(item, customization);

			return {
				id: item.id,
				lineId: JSON.stringify([item.id, customization.size || '', customization.milk || '', customization.ice || '']),
				name: item.name,
				category: item.category,
				price: unitPrice,
				basePrice: item.price,
				size: customization.size || '',
				quantity,
				lineTotal: roundStock(unitPrice * quantity),
				note: line.note || '',

				customization,
				ingredients: item.ingredients || [],
			};
		})
		.filter(Boolean);
	const subtotal = roundStock(items.reduce((total, item) => total + item.lineTotal, 0));
	const itemCount = items.reduce((total, item) => total + item.quantity, 0);

	return {
		id: `order-${Date.now()}`,
		orderNumber: `#${String(orderSequence).padStart(3, '0')}`,
		createdAt: new Date().toISOString(),
		cart: { ...cart },
		items,
		itemCount,
		subtotal,
	};
}

function buildOrderRequirements(menuItems, cart) {
	const requirementsById = {};

	Object.values(cart).forEach((line) => {
		const item = menuItems.find((menuItem) => menuItem.id === line.itemId);
		if (!item) return;
		const quantity = Number.parseFloat(line.quantity || 0);
		if (!Number.isFinite(quantity) || quantity <= 0) return;

		getValidIngredients(item.ingredients).forEach((ingredient) => {
			const id = getInventoryKey(ingredient.name, ingredient.unit);

			if (!requirementsById[id]) {
				requirementsById[id] = {
					id,
					name: ingredient.name,
					unit: ingredient.unit,
					amount: 0,
				};
			}

			requirementsById[id].amount += ingredient.amount * quantity;
		});
	});

	return Object.values(requirementsById).map((requirement) => ({
		...requirement,
		amount: roundStock(requirement.amount),
	}));
}

function findMissingIngredients(inventoryItems, requirements) {
	const inventoryById = inventoryItems.reduce((lookup, item) => ({
		...lookup,
		[item.id]: item,
	}), {});

	return requirements
		.filter((requirement) => {
			const stockItem = inventoryById[requirement.id];
			return !stockItem || stockItem.quantity < requirement.amount;
		})
		.map((requirement) => {
			const stockItem = inventoryById[requirement.id];
			return {
				...requirement,
				available: roundStock(stockItem?.quantity || 0),
			};
		});
}

function getValidIngredients(ingredients) {
	if (!Array.isArray(ingredients)) return [];

	return ingredients
		.map((ingredient) => ({
			name: String(ingredient.name || '').trim(),
			amount: Number.parseFloat(ingredient.amount),
			unit: String(ingredient.unit || '').trim(),
		}))
		.filter((ingredient) => (
			ingredient.name
			&& Number.isFinite(ingredient.amount)
			&& ingredient.amount > 0
			&& ingredient.unit
		));
}

function getInventoryKey(name, unit) {
	return `${String(name).trim().toLowerCase()}-${String(unit).trim().toLowerCase()}`;
}

function getDefaultReorderPoint(amount) {
	return roundStock(Math.max(amount * 5, 1));
}

function getDefaultRestockAmount(amount) {
	return roundStock(Math.max(amount * 20, 1));
}

function roundStock(value) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}