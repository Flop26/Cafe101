export function getSizeList(options) {
	if (options === 'coldDrink') return ['Regular', 'Large'];
	if (options === 'coffee' || options === 'size') return ['Small', 'Medium', 'Large'];
	return [];
}

export function getSizePrice(basePrice, percent) {
	return Math.round(basePrice * (1 + percent / 100) * 100) / 100;
}

// Works with a missing size or missing sizeIncreases (falls back to base price)
export function getUnitPrice(item, customization) {
	const percent = item?.sizeIncreases?.[customization?.size] ?? 0;
	return getSizePrice(item.price, percent);
}

// Derives the size type from the category's CURRENT settings
export function getOptionType(categoryName, categories = []) {
	if (categoryName === 'Coffee') return 'coffee';
	if (categoryName === 'Sodas') return 'coldDrink';
	return categories.find((category) => category.name === categoryName)?.supportsSize ? 'size' : 'none';
}