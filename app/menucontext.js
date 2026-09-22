import { createContext, useContext, useEffect, useState } from 'react';
import { databaseEnabled, loadCafeState, removeMenuItem, saveInventoryItem, saveMenuItem, saveOrder } from './api';

const initialMenuItems = [
	{
		id: 'americano',
		name: 'Cafe Americano',
		category: 'Coffee',
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
		name: 'Caffe Latte',
		category: 'Coffee',
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
		id: 'mocha',
		name: 'Mocha',
		category: 'Coffee',
		description: 'Chocolate, espresso, milk',
		price: 5,
		accent: '#7C5744',
		options: 'coffee',
		ingredients: [
			{ name: 'Espresso', amount: 18, unit: 'g' },
			{ name: 'Chocolate sauce', amount: 30, unit: 'ml' },
			{ name: 'Milk', amount: 220, unit: 'ml' },
		],
		measurementAmount: 300,
		measurementUnit: 'ml',
	},
	{
		id: 'croissant',
		name: 'Butter Croissant',
		category: 'Snacks',
		description: 'Freshly baked every morning',
		price: 3.25,
		accent: '#D29A4A',
		options: 'none',
		ingredients: [
			{ name: 'Flour', amount: 60, unit: 'g' },
			{ name: 'Butter', amount: 15, unit: 'g' },
			{ name: 'Egg', amount: 1, unit: 'piece' },
		],
		measurementAmount: 1,
		measurementUnit: 'piece',
	},
	{
		id: 'toast',
		name: 'Avocado Toast',
		category: 'Meals',
		description: 'Sourdough, avocado, herbs',
		price: 7.5,
		accent: '#76835A',
		options: 'none',
		ingredients: [
			{ name: 'Sourdough', amount: 1, unit: 'piece' },
			{ name: 'Avocado', amount: 80, unit: 'g' },
			{ name: 'Herbs', amount: 2, unit: 'g' },
		],
		measurementAmount: 1,
		measurementUnit: 'serving',
	},
	{
		id: 'lemonade',
		name: 'House Lemonade',
		category: 'Sodas',
		description: 'Fresh lemon, mint, ice',
		price: 3.75,
		accent: '#D5B744',
		options: 'coldDrink',
		ingredients: [
			{ name: 'Lemon juice', amount: 40, unit: 'ml' },
			{ name: 'Mint', amount: 2, unit: 'g' },
			{ name: 'Water', amount: 280, unit: 'ml' },
			{ name: 'Syrup', amount: 30, unit: 'ml' },
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
	createInventoryItem('Sourdough', 24, 'piece', 6, 6),
	createInventoryItem('Avocado', 5000, 'g', 1000, 1000),
	createInventoryItem('Herbs', 250, 'g', 50, 100),
	createInventoryItem('Lemon juice', 6000, 'ml', 1000, 1500),
	createInventoryItem('Mint', 300, 'g', 60, 100),
	createInventoryItem('Water', 60000, 'ml', 5000, 10000),
	createInventoryItem('Syrup', 5000, 'ml', 800, 1000),
];

const MenuContext = createContext(null);

export function MenuProvider({ children }) {
	const [menuItems, setMenuItems] = useState(initialMenuItems);
	const [inventoryItems, setInventoryItems] = useState(initialInventoryItems);
	const [pendingOrder, setPendingOrder] = useState(null);
	const [lastCompletedOrder, setLastCompletedOrder] = useState(null);
	const [orderSequence, setOrderSequence] = useState(1);

	useEffect(() => {
		if (!databaseEnabled) return;
		loadCafeState()
			.then((state) => {
				if (!state) return;
				setMenuItems(state.menuItems);
				setInventoryItems(state.inventoryItems);
			})
			.catch((error) => console.error('Could not load cafe data:', error));
	}, []);

	function createMenuItem(item) {
		setMenuItems((currentItems) => [...currentItems, item]);
		setInventoryItems((currentItems) => {
			const nextItems = addMissingInventoryItems(currentItems, item.ingredients);
			if (databaseEnabled) nextItems.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id)).forEach((nextItem) => saveInventoryItem(nextItem).catch(console.error));
			return nextItems;
		});
		if (databaseEnabled) saveMenuItem(item, true).catch(console.error);
	}

	function updateMenuItem(itemId, updates) {
		setMenuItems((currentItems) => currentItems.map((item) => (
			item.id === itemId ? { ...item, ...updates } : item
		)));
		setInventoryItems((currentItems) => {
			const nextItems = addMissingInventoryItems(currentItems, updates.ingredients);
			if (databaseEnabled) nextItems.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id)).forEach((nextItem) => saveInventoryItem(nextItem).catch(console.error));
			return nextItems;
		});
		if (databaseEnabled) saveMenuItem({ id: itemId, ...updates }).catch(console.error);
	}

	function deleteMenuItem(itemId) {
		setMenuItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
		if (databaseEnabled) removeMenuItem(itemId).catch(console.error);
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

	function createPendingOrder({ cart, notes = {}, customizations = {} }) {
		const order = buildPendingOrder(menuItems, cart, notes, customizations, orderSequence);
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

	function completePendingOrder(paymentMethod) {
		if (!pendingOrder) return { completed: false, message: 'No order is ready for payment.' };

		const result = completeOrder(pendingOrder.cart);
		if (!result.completed) return result;

		const completedOrder = {
			...pendingOrder,
			paymentMethod,
			paidAt: new Date().toISOString(),
			ingredientsDeducted: result.requirements,
		};

		setLastCompletedOrder(completedOrder);
		setPendingOrder(null);
		setOrderSequence((currentSequence) => currentSequence + 1);
		if (databaseEnabled) saveOrder(completedOrder, result.requirements).catch(console.error);

		return { ...result, order: completedOrder };
	}

	return (
		<MenuContext.Provider value={{
			menuItems,
			inventoryItems,
			pendingOrder,
			lastCompletedOrder,
			createMenuItem,
			updateMenuItem,
			deleteMenuItem,
			updateInventoryStock,
			completeOrder,
			createPendingOrder,
			clearPendingOrder,
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

function buildPendingOrder(menuItems, cart, notes, customizations, orderSequence) {
	const items = menuItems
		.filter((item) => cart[item.id])
		.map((item) => {
			const quantity = Number.parseFloat(cart[item.id] || 0);
			const customization = customizations[item.id] || {};

			return {
				id: item.id,
				name: item.name,
				category: item.category,
				price: item.price,
				quantity,
				lineTotal: roundStock(item.price * quantity),
				note: notes[item.id] || '',
				customization,
				ingredients: item.ingredients || [],
			};
		});
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

	menuItems.forEach((item) => {
		const quantity = Number.parseFloat(cart[item.id] || 0);
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
